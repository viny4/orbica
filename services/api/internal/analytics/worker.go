package analytics

import (
	"context"
	"log"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Package-level worker state. Set once by Register at startup.
var (
	pool         *pgxpool.Pool
	eventChannel chan *Event
)

// initWorker wires the pool and starts the background batch processor. The
// buffered channel decouples request handling from DB writes; a full buffer
// drops events (see trackEvent) rather than blocking the API.
func initWorker(p *pgxpool.Pool, bufferSize int) {
	pool = p
	eventChannel = make(chan *Event, bufferSize)
	go startBatchProcessor()
}

// startBatchProcessor flushes queued events every second, or as soon as 100 pile
// up — whichever comes first.
func startBatchProcessor() {
	var batch []*Event
	ticker := time.NewTicker(time.Second)
	defer ticker.Stop()

	for {
		select {
		case e := <-eventChannel:
			batch = append(batch, e)
			if len(batch) >= 100 {
				flushBatch(batch)
				batch = nil
			}
		case <-ticker.C:
			if len(batch) > 0 {
				flushBatch(batch)
				batch = nil
			}
		}
	}
}

const insertSQL = `
	INSERT INTO analytics_events (
		anonymous_user_id, session_id, event_type, payload, path, referrer,
		country, city, region, browser, os, device, screen_resolution,
		is_bot, cf_ray, ip_hash, tracker_version
	) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`

func flushBatch(events []*Event) {
	if len(events) == 0 {
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	tx, err := pool.Begin(ctx)
	if err != nil {
		log.Printf("analytics: begin tx: %v", err)
		return
	}
	defer tx.Rollback(ctx)

	b := &pgx.Batch{}
	for _, e := range events {
		// Empty payload must go in as NULL, not "" (invalid json).
		var payload any
		if len(e.Payload) > 0 {
			payload = e.Payload
		}
		b.Queue(insertSQL,
			e.AnonymousUserID, e.SessionID, e.EventType, payload, e.Path, e.Referrer,
			e.Country, e.City, e.Region, e.Browser, e.OS, e.Device, e.ScreenRes,
			e.IsBot, e.CFRay, e.IPHash, e.TrackerVersion,
		)
	}

	br := tx.SendBatch(ctx, b)
	for range events {
		if _, err := br.Exec(); err != nil {
			log.Printf("analytics: insert event: %v", err)
		}
	}
	// Results must be closed before Commit releases the connection.
	if err := br.Close(); err != nil {
		log.Printf("analytics: close batch: %v", err)
	}

	if err := tx.Commit(ctx); err != nil {
		log.Printf("analytics: commit batch: %v", err)
	}
}
