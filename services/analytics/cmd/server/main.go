package main

import (
	"log"
	"os"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/joho/godotenv"

	"github.com/viny4/orbica/services/analytics/internal/api"
	"github.com/viny4/orbica/services/analytics/internal/db"
	"github.com/viny4/orbica/services/analytics/internal/worker"
)

func main() {
	// Load .env file from root
	if err := godotenv.Load(".env"); err != nil {
		log.Println("No .env file found or failed to load")
	}

	// Initialize Database
	if err := db.ConnectDB(); err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	// Initialize Background Worker (Buffer size of 10,000 events)
	worker.InitWorker(10000)

	// Setup Fiber App
	app := fiber.New(fiber.Config{
		BodyLimit: 64 * 1024, // 64 KB limit to prevent abuse
	})

	app.Use(cors.New(cors.Config{
		AllowOrigins: "*",
		AllowHeaders: "Origin, Content-Type, Accept",
	}))

	// Health Check
	app.Get("/health", func(c *fiber.Ctx) error {
		return c.SendString("Analytics Service OK")
	})

	api.SetupRoutes(app)

	// Render/most PaaS inject PORT and expect the app to bind to it; fall back to
	// ANALYTICS_PORT (docker-compose) then a local default.
	port := os.Getenv("PORT")
	if port == "" {
		port = os.Getenv("ANALYTICS_PORT")
	}
	if port == "" {
		port = "4001"
	}

	log.Printf("Analytics Service running on port %s", port)
	log.Fatal(app.Listen(":" + port))
}
