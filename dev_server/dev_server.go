package main

import (
	"flag"
	"log"
	"net/http"
)

func main() {
	// Command-line flags for port and directory
	port := flag.String("port", "8000", "port to serve on")
	dir := flag.String("dir", ".", "the directory to serve")
	flag.Parse()

	// Set up file server handler
	fs := http.FileServer(http.Dir(*dir))
	http.Handle("/", fs)

	log.Printf("Serving files from %s on http://localhost:%s/", *dir, *port)

	// Start HTTP server
	if err := http.ListenAndServe(":"+*port, nil); err != nil {
		log.Fatal(err)
	}
}
