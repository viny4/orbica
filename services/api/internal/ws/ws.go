// Package ws bridges fiber websocket connections to the hub.
package ws

import (
	"encoding/json"
	"sync"
	"time"

	"github.com/gofiber/contrib/websocket"
	"github.com/gofiber/fiber/v2"

	"github.com/orbica/api/internal/hub"
)

const (
	// A client that can't take a frame within this long is stalled. Without a
	// deadline one dead TCP peer blocked the hub's sequential send loop — and
	// froze the stream for every other viewer.
	writeTimeout = 5 * time.Second
	// Inbound messages are tiny control frames; anything larger is abuse.
	maxMessageBytes = 4 << 10
	// Cap per-connection subscriptions (the full catalogue is ~16k anyway).
	maxSubs = 20_000
	// The time machine scrubs ±6h in the UI; allow a generous ±7 days.
	maxOffset = 7 * 24 * time.Hour
)

// inbound is the client → server control message.
type inbound struct {
	Action        string `json:"action"` // subscribe | unsubscribe | subscribe_all | set_time
	NoradID       int    `json:"norad_id"`
	OffsetSeconds int64  `json:"offset_seconds"` // time-machine offset from now
}

// conn implements hub.Client for a single WebSocket connection.
type conn struct {
	ws     *websocket.Conn
	mu     sync.Mutex // guards subs + offset
	wmu    sync.Mutex // serialises writes
	subs   map[int]struct{}
	offset time.Duration
}

func (c *conn) Subs() map[int]struct{} {
	c.mu.Lock()
	defer c.mu.Unlock()
	out := make(map[int]struct{}, len(c.subs))
	for k := range c.subs {
		out[k] = struct{}{}
	}
	return out
}

func (c *conn) Offset() time.Duration {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.offset
}

func (c *conn) Send(payload []byte) {
	c.wmu.Lock()
	defer c.wmu.Unlock()
	_ = c.ws.SetWriteDeadline(time.Now().Add(writeTimeout))
	if err := c.ws.WriteMessage(websocket.TextMessage, payload); err != nil {
		_ = c.ws.Close() // the read loop then exits and unregisters us
	}
}

// Handler returns a fiber.Handler that upgrades and serves the hub.
func Handler(h *hub.Hub) fiber.Handler {
	// Per-message deflate: the payload is highly repetitive numeric text, so it
	// compresses hard and the CPU cost is trivial next to the egress saved.
	return websocket.New(func(c *websocket.Conn) {
		c.SetReadLimit(maxMessageBytes)
		client := &conn{ws: c, subs: make(map[int]struct{})}
		h.Register(client)
		defer func() {
			h.Unregister(client)
			_ = c.Close()
		}()

		for {
			_, data, err := c.ReadMessage()
			if err != nil {
				return // client gone (or sent an oversized frame)
			}
			var msg inbound
			if err := json.Unmarshal(data, &msg); err != nil {
				continue
			}
			client.apply(msg)
		}
	}, websocket.Config{EnableCompression: true})
}

func (c *conn) apply(msg inbound) {
	c.mu.Lock()
	defer c.mu.Unlock()
	switch msg.Action {
	case "subscribe":
		if len(c.subs) < maxSubs {
			c.subs[msg.NoradID] = struct{}{}
		}
	case "unsubscribe":
		delete(c.subs, msg.NoradID)
	case "subscribe_all":
		c.subs = make(map[int]struct{}) // empty set = all satellites
	case "set_time":
		off := time.Duration(msg.OffsetSeconds) * time.Second
		if off > maxOffset {
			off = maxOffset
		} else if off < -maxOffset {
			off = -maxOffset
		}
		c.offset = off
	}
}

// Encode is the hub's wire encoder (see encodePositions).
var Encode hub.Encoder = encodePositions
