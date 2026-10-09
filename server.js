const http = require("http");
const fs = require("fs");
const path = require("path");
const clients = new Set();

const server = http.createServer((req, res) => {

    // GET messages
    if (req.url === "/messages.json" && req.method === "GET") {
        fs.readFile("messages.json", "utf8", (err, data) => {

            if (err) {
                console.log("Error reading messages.json:", err);

                res.writeHead(500, {
                    "Content-Type": "text/plain"
                });

                res.end("Error reading messages");
                return;
            }

            res.writeHead(200, {
                "Content-Type": "application/json"
            });

            res.end(data);
        });

        return;
    }


    // POST message
    if (req.url === "/messages.json" && req.method === "POST") {

        let body = "";

        req.on("data", chunk => {
            body += chunk;
        });

        req.on("end", () => {
            const newMessage = JSON.parse(body);

            const messages = JSON.parse(
                fs.readFileSync("messages.json", "utf8")
            );

            messages.push(newMessage);

            fs.writeFileSync(
                "messages.json",
                JSON.stringify(messages, null, 4)
            );

            res.writeHead(200, {
                "Content-Type": "application/json"
            });

            res.end(JSON.stringify({
                success: true
            }));

            for (const client of clients) {
                client.write(
                    `data: ${JSON.stringify(newMessage)}\n\n`
                );
            }

        });

        return;
    }


    // Serve files from public
    let filePath;

    if (req.url === "/") {
        filePath = "public/index.html";
    } else {
        filePath = req.url.substring(1);
    }

    if (req.url === "/events") {
        res.writeHead(200, {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive"
        });

        res.write("\n");
        clients.add(res);

        req.on("close", () => {
            clients.delete(res);
        });

        return;
    }

    fs.readFile(filePath, (err, data) => {

        if (err) {
            console.log("File not found:", filePath);

            res.writeHead(404);
            res.end("File not found");
            return;
        }

        res.writeHead(200);
        res.end(data);
    });
});


server.listen(3000, () => {
    console.log("Server running at http://127.0.0.1:3000");
});