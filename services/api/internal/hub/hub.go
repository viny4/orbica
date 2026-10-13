// Package hub fans out live satellite positions to subscribed WebSocket clients.
package hub

import (
	"sync"
	"time"

	"github.com/orbica/api/internal/propagate"
)

// Client is anything that can receive an encoded position payload.
type Client interface {
	Send(payload []byte)
	// Subs returns the set of NORAD ids this client wants (empty = all).
	Subs() map[int]struct{}
	// Offset is the client's time-machine offset from now (0 = live).
	Offset() time.Duration
}

// Encoder turns a set of positions into the wire payload.
type Encoder func([]propagate.Position) []byte

// Hub holds the TLE catalog and the connected clients, and ticks out positions.
type Hub struct {
	mu       sync.RWMutex
	catalog  map[int]propagate.Propagator // norad_id -> propagator
	clients  map[Client]struct{}
	interval time.Duration
	encode   Encoder
}

func New(interval time.Duration, encode Encoder) *Hub {
	return &Hub{
		catalog:  make(map[int]propagate.Propagator),
		clients:  make(map[Client]struct{}),
		interval: interval,
		encode:   encode,
	}
}

// LoadTLE inserts or replaces a satellite's propagator in the catalog.
func (h *Hub) LoadTLE(noradID int, name, line1, line2 string) {
	p := propagate.New(noradID, name, line1, line2)
	h.mu.Lock()
	h.catalog[noradID] = p
	h.mu.Unlock()
}

func (h *Hub) Register(c Client) {
	h.mu.Lock()
	h.clients[c] = struct{}{}
	h.mu.Unlock()
}

func (h *Hub) Unregister(c Client) {
	h.mu.Lock()
	delete(h.clients, c)
	h.mu.Unlock()
}

// CatalogSize reports how many satellites are loaded.
func (h *Hub) CatalogSize() int {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return len(h.catalog)
}

// ClientCount reports how many WebSocket clients are connected.
func (h *Hub) ClientCount() int {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return len(h.clients)
}

// Run ticks at the hub interval, propagating and pushing positions to each
// client. Blocks until the channel is closed.
func (h *Hub) Run(stop <-chan struct{}) {
	ticker := time.NewTicker(h.interval)
	defer ticker.Stop()
	for {
		select {
		case <-stop:
			return
		case now := <-ticker.C:
			h.tick(now)
		}
	}
}

// tick sends every client its positions. Propagating ~16k satellites and
// encoding the result is the expensive part, and almost every viewer wants the
// same thing (the whole sky, live), so the work is done ONCE per distinct
// time-machine offset and the same bytes go to everyone sharing it. It used to
// run per client: 50 viewers meant 50 full-catalogue SGP4 passes every tick.
// Clients with an explicit subscription set still get their own (small) pass.
func (h *Hub) tick(now time.Time) {
	h.mu.RLock()
	clients := make([]Client, 0, len(h.clients))
	for c := range h.clients {
		clients = append(clients, c)
	}
	h.mu.RUnlock()

	shared := make(map[time.Duration][]byte)
	for _, c := range clients {
		subs := c.Subs()
		off := c.Offset()
		var payload []byte
		if len(subs) == 0 {
			p, ok := shared[off]
			if !ok {
				if ps := h.positionsFor(nil, now.Add(off)); len(ps) > 0 {
					p = h.encode(ps)
				}
				shared[off] = p // nil = empty catalogue, remembered too
			}
			payload = p
		} else if ps := h.positionsFor(subs, now.Add(off)); len(ps) > 0 {
			payload = h.encode(ps)
		}
		if payload != nil { // nothing to report → no empty frame
			c.Send(payload)
		}
	}
}

// positionsFor computes positions for the requested norad ids (or all if empty).
func (h *Hub) positionsFor(subs map[int]struct{}, at time.Time) []propagate.Position {
	h.mu.RLock()
	defer h.mu.RUnlock()

	if len(subs) == 0 {
		out := make([]propagate.Position, 0, len(h.catalog))
		for _, p := range h.catalog {
			out = append(out, p.At(at))
		}
		return out
	}
	out := make([]propagate.Position, 0, len(subs))
	for id := range subs {
		if p, ok := h.catalog[id]; ok {
			out = append(out, p.At(at))
		}
	}
	return out
}
