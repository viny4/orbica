package hub

import (
	"strconv"
	"sync"
	"testing"
	"time"

	"github.com/orbica/api/internal/propagate"
)

// ISS + Hubble element sets (valid TLEs; exact epoch doesn't matter here).
const (
	issL1    = "1 25544U 98067A   24001.50000000  .00016717  00000-0  10270-3 0  9005"
	issL2    = "2 25544  51.6416 247.4627 0006703 130.5360 325.0288 15.50377579999995"
	hubbleL1 = "1 20580U 90037B   24001.50000000  .00000990  00000-0  48543-4 0  9994"
	hubbleL2 = "2 20580  28.4697 106.8240 0002473 162.6713 300.0939 15.15330658999992"
)

type fakeClient struct {
	mu     sync.Mutex
	subs   map[int]struct{}
	offset time.Duration
	got    [][]byte
}

func (f *fakeClient) Send(p []byte) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.got = append(f.got, p)
}
func (f *fakeClient) Subs() map[int]struct{} { return f.subs }
func (f *fakeClient) Offset() time.Duration  { return f.offset }

// countingEncoder records how many full encodes happen and how many positions
// each contained.
type countingEncoder struct {
	mu    sync.Mutex
	calls []int
}

func (e *countingEncoder) encode(ps []propagate.Position) []byte {
	e.mu.Lock()
	defer e.mu.Unlock()
	e.calls = append(e.calls, len(ps))
	return []byte("[" + strconv.Itoa(len(ps)) + "]")
}

func newHub(enc *countingEncoder) *Hub {
	h := New(time.Second, enc.encode)
	h.LoadTLE(25544, "ISS", issL1, issL2)
	h.LoadTLE(20580, "HST", hubbleL1, hubbleL2)
	return h
}

func TestTickComputesOncePerOffsetForWholeSkyClients(t *testing.T) {
	enc := &countingEncoder{}
	h := newHub(enc)

	live := []*fakeClient{{}, {}, {}, {}, {}}
	for _, c := range live {
		h.Register(c)
	}
	scrubbed := &fakeClient{offset: 2 * time.Hour}
	h.Register(scrubbed)

	h.tick(time.Now())

	// 5 live viewers share one pass; the time-machine viewer gets its own.
	if len(enc.calls) != 2 {
		t.Fatalf("encodes per tick = %d, want 2 (one per distinct offset)", len(enc.calls))
	}
	for i, c := range append(live, scrubbed) {
		if len(c.got) != 1 || string(c.got[0]) != "[2]" {
			t.Fatalf("client %d got %q", i, c.got)
		}
	}
	// Live viewers receive the very same buffer (no per-client copies).
	if &live[0].got[0][0] != &live[4].got[0][0] {
		t.Fatal("live clients should share one encoded payload")
	}
}

func TestTickHonoursExplicitSubscriptions(t *testing.T) {
	enc := &countingEncoder{}
	h := newHub(enc)
	one := &fakeClient{subs: map[int]struct{}{25544: {}}}
	unknown := &fakeClient{subs: map[int]struct{}{99999: {}}}
	h.Register(one)
	h.Register(unknown)

	h.tick(time.Now())

	if len(one.got) != 1 || string(one.got[0]) != "[1]" {
		t.Fatalf("subscribed client got %q", one.got)
	}
	// Nothing to report → nothing sent (empty "[]" frames are suppressed).
	if len(unknown.got) != 0 {
		t.Fatalf("client subscribed to unknown id got %q", unknown.got)
	}
}

func TestUnregisterStopsDelivery(t *testing.T) {
	enc := &countingEncoder{}
	h := newHub(enc)
	c := &fakeClient{}
	h.Register(c)
	h.Unregister(c)
	h.tick(time.Now())
	if len(c.got) != 0 || h.ClientCount() != 0 {
		t.Fatal("unregistered client still received data")
	}
}
