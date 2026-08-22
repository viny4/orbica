// Package ws bridges fiber websocket connections to the hub.
package ws

import (
	"encoding/json"
	"sync"
	"time"

	"github.com/gofiber/contrib/websocket"
	"github.com/gofiber/fiber/v2"

	"github.com/orbica/api/internal/hub"
	"github.com/orbica/api/internal/propagate"
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
	mu     sync.Mutex // guards writes + subs + offset
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

func (c *conn) Send(positions []propagate.Position) {
	c.mu.Lock()
	defer c.mu.Unlock()
	// Hand-rolled compact encoding rather than WriteJSON — see encodePositions.
	if err := c.ws.WriteMessage(websocket.TextMessage, encodePositions(positions)); err != nil {
		_ = c.ws.Close()
	}
}

// Handler returns a fiber.Handler that upgrades and serves the hub.
func Handler(h *hub.Hub) fiber.Handler {
	// Per-message deflate: the payload is highly repetitive numeric text, so it
	// compresses hard and the CPU cost is trivial next to the egress saved.
	return websocket.New(func(c *websocket.Conn) {
		client := &conn{ws: c, subs: make(map[int]struct{})}
		h.Register(client)
		defer func() {
			h.Unregister(client)
			_ = c.Close()
		}()

		for {
			_, data, err := c.ReadMessage()
			if err != nil {
				return // client gone
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
		c.subs[msg.NoradID] = struct{}{}
	case "unsubscribe":
		delete(c.subs, msg.NoradID)
	case "subscribe_all":
		c.subs = make(map[int]struct{}) // empty set = all satellites
	case "set_time":
		c.offset = time.Duration(msg.OffsetSeconds) * time.Second
	}
}
