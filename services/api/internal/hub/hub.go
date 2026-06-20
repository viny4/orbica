// Package hub fans out live satellite positions to subscribed WebSocket clients.
package hub

import (
	"sync"
	"time"

	"github.com/orbica/api/internal/propagate"
)

// Client is anything that can receive position JSON payloads.
type Client interface {
	Send(positions []propagate.Position)
	// Subs returns the set of NORAD ids this client wants (empty = all).
	Subs() map[int]struct{}
	// Offset is the client's time-machine offset from now (0 = live).
	Offset() time.Duration
}

// Hub holds the TLE catalog and the connected clients, and ticks out positions.
type Hub struct {
	mu       sync.RWMutex
	catalog  map[int]propagate.Propagator // norad_id -> propagator
	clients  map[Client]struct{}
	interval time.Duration
}

func New(interval time.Duration) *Hub {
	return &Hub{
		catalog:  make(map[int]propagate.Propagator),
		clients:  make(map[Client]struct{}),
		interval: interval,
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

// Run ticks at the hub interval, propagating every subscribed satellite and
// pushing positions to each client. Blocks until the channel is closed.
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

func (h *Hub) tick(now time.Time) {
	h.mu.RLock()
	clients := make([]Client, 0, len(h.clients))
	for c := range h.clients {
		clients = append(clients, c)
	}
	h.mu.RUnlock()

	for _, c := range clients {
		subs := c.Subs()
		// Each client can scrub time independently (time machine).
		positions := h.positionsFor(subs, now.Add(c.Offset()))
		if len(positions) > 0 {
			c.Send(positions)
		}
	}
}

// positionsFor computes positions for the requested norad ids (or all if empty).
func (h *Hub) positionsFor(subs map[int]struct{}, now time.Time) []propagate.Position {
	h.mu.RLock()
	defer h.mu.RUnlock()

	out := make([]propagate.Position, 0, len(subs))
	if len(subs) == 0 {
		for _, p := range h.catalog {
			out = append(out, p.At(now))
		}
		return out
	}
	for id := range subs {
		if p, ok := h.catalog[id]; ok {
			out = append(out, p.At(now))
		}
	}
	return out
}
