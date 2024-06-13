const express = require("express");
const fileUpload = require("express-fileupload");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = 3000;

// Middleware
app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));
app.use(fileUpload());

// Verifica e cria a pasta 'uploads' se não existir
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// Banco de Dados
let db = new sqlite3.Database("./database.db", (err) => {
  if (err) {
    console.error(err.message);
  }
  console.log("Connected to the SQLite database.");
});

db.run(`CREATE TABLE IF NOT EXISTS files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    description TEXT NOT NULL,
    filename TEXT NOT NULL
)`);

db.run(`CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_id INTEGER NOT NULL,
    comment TEXT NOT NULL,
    FOREIGN KEY (file_id) REFERENCES files (id)
)`);

db.run(`CREATE TABLE IF NOT EXISTS updates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_id INTEGER NOT NULL,
    description TEXT NOT NULL,
    filename TEXT NOT NULL,
    FOREIGN KEY (file_id) REFERENCES files (id)
)`);

// Rota para a página inicial
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Rota para upload
app.post("/upload", (req, res) => {
  if (!req.files || Object.keys(req.files).length === 0) {
    return res.status(400).send("No files were uploaded.");
  }

  let file = req.files.file;
  let description = req.body.description;
  let uploadPath = path.join(__dirname, "uploads", file.name);

  file.mv(uploadPath, function (err) {
    if (err) {
      return res.status(500).send(err);
    }

    // Salvar informações no banco de dados
    db.run(
      `INSERT INTO files (description, filename) VALUES (?, ?)`,
      [description, file.name],
      function (err) {
        if (err) {
          return console.log(err.message);
        }
        console.log(`A row has been inserted with rowid ${this.lastID}`);
        res.redirect("/");
      }
    );
  });
});

// Rota para adicionar um comentário
app.post("/add-comment", (req, res) => {
  let file_id = req.body.file_id;
  let comment = req.body.comment;

  db.run(
    `INSERT INTO comments (file_id, comment) VALUES (?, ?)`,
    [file_id, comment],
    function (err) {
      if (err) {
        return res.status(500).send(err.message);
      }
      res.redirect("/");
    }
  );
});

// Rota para visualizar comentários de um arquivo
app.get("/comments/:file_id", (req, res) => {
  const file_id = req.params.file_id;
  db.all(`SELECT * FROM comments WHERE file_id = ?`, [file_id], (err, rows) => {
    if (err) {
      return res.status(500).send(err.message);
    }
    res.json(rows);
  });
});


// Rota para upload de atualização
app.post("/update/:id", (req, res) => {
  const fileId = req.params.id;
  const description = req.body.description;
  if (!req.files || Object.keys(req.files).length === 0) {
    return res.status(400).send("No files were uploaded.");
  }

  const file = req.files.file;
  const uploadPath = path.join(__dirname, "uploads", file.name);

  file.mv(uploadPath, function (err) {
    if (err) {
      return res.status(500).send(err);
    }

    // Salvar informações da atualização no banco de dados
    db.run(
      `INSERT INTO updates (file_id, description, filename) VALUES (?, ?, ?)`,
      [fileId, description, file.name],
      function (err) {
        if (err) {
          return res.status(500).send(err.message);
        }
        res.redirect("/");
      }
    );
  });
});

// Rota para visualizar arquivos
app.get("/files", (req, res) => {
  db.all(`SELECT * FROM files`, [], (err, rows) => {
    if (err) {
      throw err;
    }
    res.json(rows);
  });
});

// Rota para visualizar atualizações de um arquivo
app.get("/updates/:file_id", (req, res) => {
  const file_id = req.params.file_id;
  db.all(`SELECT * FROM updates WHERE file_id = ?`, [file_id], (err, rows) => {
    if (err) {
      return res.status(500).send(err.message);
    }
    res.json(rows);
  });
});

// Rota para abrir arquivo
app.get("/uploads/:filename", (req, res) => {
  let filepath = path.join(__dirname, "uploads", req.params.filename);
  res.sendFile(filepath);
});

// Rota para excluir um upload e seus comentários associados
app.delete("/delete/:id", (req, res) => {
  const fileId = req.params.id;

  // Excluir comentários associados
  db.run(`DELETE FROM comments WHERE file_id = ?`, [fileId], function (err) {
    if (err) {
      return res.status(500).send(err.message);
    }

    // Excluir atualizações associadas
    db.run(`DELETE FROM updates WHERE file_id = ?`, [fileId], function (err) {
      if (err) {
        return res.status(500).send(err.message);
      }

      // Excluir o arquivo do sistema de arquivos
      db.get(
        `SELECT filename FROM files WHERE id = ?`,
        [fileId],
        (err, row) => {
          if (err) {
            return res.status(500).send(err.message);
          }

          if (row) {
            const filePath = path.join(__dirname, "uploads", row.filename);
            fs.unlink(filePath, (err) => {
              if (err) {
                return res.status(500).send(err.message);
              }

              // Excluir o registro do arquivo no banco de dados
              db.run(
                `DELETE FROM files WHERE id = ?`,
                [fileId],
                function (err) {
                  if (err) {
                    return res.status(500).send(err.message);
                  }

                  res.sendStatus(200);
                }
              );
            });
          } else {
            res.sendStatus(404);
          }
        }
      );
    });
  });
});

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}/`);
});

