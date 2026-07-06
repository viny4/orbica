package worker

import (
	"context"
	"log"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/viny4/orbica/services/analytics/internal/db"
	"github.com/viny4/orbica/services/analytics/internal/models"
)

var (
	EventChannel chan *models.AnalyticsEvent
)

func InitWorker(bufferSize int) {
	EventChannel = make(chan *models.AnalyticsEvent, bufferSize)
	go startBatchProcessor()
}

func startBatchProcessor() {
	var batch []*models.AnalyticsEvent
	ticker := time.NewTicker(1 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case event := <-EventChannel:
			batch = append(batch, event)
			if len(batch) >= 100 {
				flushBatch(batch)
				batch = nil // Reset batch
			}
		case <-ticker.C:
			if len(batch) > 0 {
				flushBatch(batch)
				batch = nil // Reset batch
			}
		}
	}
}

func flushBatch(batch []*models.AnalyticsEvent) {
	if len(batch) == 0 {
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Bulk insert query
	// In pgx, the most efficient way to bulk insert is using the CopyFrom interface
	// However, for 100 events, a parameterized INSERT with multiple values is also fast and simpler to write.
	// Let's use a simple transactional insert for now.
	
	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		log.Printf("Failed to begin transaction: %v", err)
		return
	}
	defer tx.Rollback(ctx)

	batchInsert := &pgx.Batch{}

	sqlStr := `
		INSERT INTO analytics_events (
			anonymous_user_id, session_id, event_type, payload, path, referrer,
			country, city, region, browser, os, device, screen_resolution,
			is_bot, cf_ray, ip_hash, tracker_version
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17
		)
	`
	
	for _, e := range batch {
		batchInsert.Queue(sqlStr,
			e.AnonymousUserID, e.SessionID, e.EventType, e.Payload, e.Path, e.Referrer,
			e.Country, e.City, e.Region, e.Browser, e.OS, e.Device, e.ScreenRes,
			e.IsBot, e.CFRay, e.IPHash, e.TrackerVersion,
		)
	}

	br := tx.SendBatch(ctx, batchInsert)
	defer br.Close()

	for i := 0; i < len(batch); i++ {
		_, err := br.Exec()
		if err != nil {
			log.Printf("Failed to insert event in batch: %v", err)
		}
	}

	// Must close the batch results before committing the transaction to release the connection
	br.Close()

	err = tx.Commit(ctx)
	if err != nil {
		log.Printf("Failed to commit batch: %v", err)
	}
}
