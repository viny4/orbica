// Package ws bridges gorilla/websocket connections to the hub.
package ws

import (
	"encoding/json"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"github.com/orbica/tracker/internal/hub"
	"github.com/orbica/tracker/internal/propagate"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1 << 16,
	CheckOrigin:     func(r *http.Request) bool { return true }, // tighten in prod
}

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
	if err := c.ws.WriteJSON(positions); err != nil {
		_ = c.ws.Close()
	}
}

// Handler returns an http.HandlerFunc that upgrades and serves the hub.
func Handler(h *hub.Hub) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		socket, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			log.Printf("ws upgrade: %v", err)
			return
		}
		c := &conn{ws: socket, subs: make(map[int]struct{})}
		h.Register(c)
		defer func() {
			h.Unregister(c)
			_ = socket.Close()
		}()

		for {
			_, data, err := socket.ReadMessage()
			if err != nil {
				return // client gone
			}
			var msg inbound
			if err := json.Unmarshal(data, &msg); err != nil {
				continue
			}
			c.apply(msg)
		}
	}
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
