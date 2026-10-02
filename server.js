const http = require("http");
const fs = require("fs");
const path = require("path");

const server = http.createServer((req, res) => {

    let filePath;

    if (req.url === "/") {
        filePath = "public/index.html";
    } else {
        filePath = path.join("public", req.url);
    }

    fs.readFile(filePath, (err, data) => {

        if (err) {
            res.writeHead(404);
            res.end("File not found");
            return;
        }

        res.writeHead(200);
        res.end(data);
    });
});

server.listen(3000, () => {
    console.log("Server running at http://localhost:3000");
});