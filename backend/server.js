
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const multer = require('multer');
const path = require('path');

const app = express();
app.use(cors());
app.use(bodyParser.json());

const PORT = process.env.PORT || 5000;

let rooms = {};

const http = require('http');
const server = http.createServer(app);

const { Server } = require('socket.io');
const io = new Server(server, {
  cors: {
    origin: '*',
  },
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});
const upload = multer({ storage });

io.on('connection', (socket) => {
  console.log('a user connected');

  socket.on('create_room', (roomId) => {
    if (!rooms[roomId]) {
      rooms[roomId] = { users: [], messages: [] };
      socket.join(roomId);
      console.log(`Room created: ${roomId}`);
    }
  });

  socket.on('join_room', ({ roomId, username }) => {
    if (rooms[roomId]) {
      rooms[roomId].users.push(username);
      socket.join(roomId);
      io.to(roomId).emit('user_joined', username);
      io.to(roomId).emit('update_users', rooms[roomId].users);
    }
  });

  socket.on('leave_room', ({ roomId, username }) => {
    if (rooms[roomId]) {
      rooms[roomId].users = rooms[roomId].users.filter(user => user !== username);
      if (rooms[roomId].users.length === 0) {
        delete rooms[roomId];
      }
      socket.leave(roomId);
      io.to(roomId).emit('user_left', username);
      io.to(roomId).emit('update_users', rooms[roomId] ? rooms[roomId].users : []);
    }
  });

  socket.on('send_message', ({ roomId, username, text }) => {
    if (rooms[roomId]) {
      const message = { user: username, text };
      rooms[roomId].messages.push(message);
      io.to(roomId).emit('message', message);
    }
  });

  socket.on('disconnect', () => {
    console.log('user disconnected');
  });
});

app.post('/create_room', (req, res) => {
  const { roomId } = req.body;
  if (!roomId) {
    return res.status(400).send('Room ID is required');
  }
  
  if (rooms[roomId]) {
    return res.status(400).send('Room already exists');
  }
  
  rooms[roomId] = { users: [], messages: [] };
  res.status(201).send('Room created');
});

app.post('/join_room', (req, res) => {
  const { roomId, username } = req.body;
  if (!rooms[roomId]) {
    return res.status(404).send('Room not found');
  }
  if (rooms[roomId].users.includes(username)) {
    return res.status(400).send('User already in the room');
  }
  res.status(200).send('Joined room');
});

app.post('/leave_room', (req, res) => {
  const { roomId, username } = req.body;
  if (rooms[roomId]) {
    rooms[roomId].users = rooms[roomId].users.filter(user => user !== username);
    if (rooms[roomId].users.length === 0) {
      delete rooms[roomId];
    }
    res.status(200).send('Left room');
  } else {
    res.status(404).send('Room not found');
  }
});

app.post('/upload_file', upload.single('file'), (req, res) => {
  const { roomId, username } = req.body;
  if (rooms[roomId]) {
    const message = { user: username, fileName: req.file.filename };
    rooms[roomId].messages.push(message);
    io.to(roomId).emit('message', message);
    res.status(200).send('File uploaded and message sent');
  } else {
    res.status(404).send('Room not found');
  }
});

app.get('/messages/:roomId', (req, res) => {
  const { roomId } = req.params;
  if (rooms[roomId]) {
    res.json(rooms[roomId].messages);
  } else {
    res.status(404).send('Room not found');
  }
});
app.get("/", (req, res) => {
  res.send("App is running perfect");
});


app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
