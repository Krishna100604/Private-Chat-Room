
import React, { useState, useEffect } from 'react';
import './App.css';
import io from 'socket.io-client';

const BASE_URL = 'https://private-chat-room-server.vercel.app/';

function App() {
  const [username, setUsername] = useState('');
  const [roomId, setRoomId] = useState('');
  const [inRoom, setInRoom] = useState(false);
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState('');
  const [file, setFile] = useState(null);
  const [users, setUsers] = useState([]);

  useEffect(() => {
    const storedUsername = localStorage.getItem('username');
    const storedRoomId = localStorage.getItem('roomId');

    if (storedUsername && storedRoomId) {
      setUsername(storedUsername);
      setRoomId(storedRoomId);
      setInRoom(true);
    }
  }, []);

  useEffect(() => {
    if (inRoom) {
      const socket = io(BASE_URL);

      socket.emit('join_room', { roomId, username });

      socket.on('message', (message) => {
        setMessages((prevMessages) => [...prevMessages, message]);
      });

      socket.on('user_joined', (user) => {
        setMessages((prevMessages) => [...prevMessages, { user: 'system', text: `${user} joined the room` }]);
        setUsers((prevUsers) => [...new Set([...prevUsers, user])]); // Use Set to ensure unique usernames
      });

      socket.on('user_left', (user) => {
        setMessages((prevMessages) => [...prevMessages, { user: 'system', text: `${user} left the room` }]);
        setUsers((prevUsers) => prevUsers.filter(u => u !== user));
      });

      socket.on('update_users', (updatedUsers) => {
        setUsers(updatedUsers);
      });

      const fetchMessages = async () => {
        const response = await fetch(`${BASE_URL}/messages/${roomId}`);
        if (response.ok) {
          const data = await response.json();
          setMessages(data);
        }
      };

      fetchMessages();

      return () => {
        socket.emit('leave_room', { roomId, username });
        socket.disconnect();
      };
    }
  }, [inRoom, roomId, username]);

  const createRoom = async () => {
    const response = await fetch(`${BASE_URL}/create_room`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId }),
    });
    if (response.ok) {
      localStorage.setItem('username', username);
      localStorage.setItem('roomId', roomId);
      setInRoom(true);
    }
  };

  const joinRoom = async () => {
    const response = await fetch(`${BASE_URL}/join_room`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId, username }),
    });
    if (response.ok) {
      localStorage.setItem('username', username);
      localStorage.setItem('roomId', roomId);
      setInRoom(true);
    }
  };

  const leaveRoom = async () => {
    await fetch(`${BASE_URL}/leave_room`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId, username }),
    });
    localStorage.removeItem('username');
    localStorage.removeItem('roomId');
    setInRoom(false);
    setMessages([]);
    setUsers([]);
  };

  const sendMessage = async (e) => {
    if ((e.type === 'click' || e.key === 'Enter') && message.trim() !== '') {
      const socket = io(BASE_URL);
      socket.emit('send_message', { roomId, username, text: message });
      setMessage('');
    }
  };

  const sendFile = async () => {
    if (file) {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('roomId', roomId);
      formData.append('username', username);

      const response = await fetch(`${BASE_URL}/upload_file`, {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        setFile(null); // Clear the file input after sending
      }
    }
  };

  return (
    <div className="App">
      {!inRoom ? (
        <div className="room-container">
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter Username"
            className="room-input"
          />
          <input
            type="text"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            placeholder="Enter Room ID"
            className="room-input"
          />
          <div className="room-buttons">
            <button onClick={createRoom} className="room-button">Create Room</button>
            <button onClick={joinRoom} className="room-button">Join Room</button>
          </div>
        </div>
      ) : (
        <div className="chat-container">
          <div className="header">
            <h2>Room: {roomId}</h2>
            <button onClick={leaveRoom} className="leave-button">Leave Room</button>
          </div>
          <div className="messages-container">
            {messages.map((msg, index) => (
              <div
                key={index}
                className={`message ${msg.user === 'system' ? 'system' : msg.user === username ? 'me' : ''}`}
              >
                {msg.user !== 'system' && <strong>{msg.user}: </strong>}
                {msg.text ? (
                  msg.text
                ) : (
                  msg.fileName.endsWith('.pdf') ? (
                    <a href={`${BASE_URL}/uploads/${msg.fileName}`} target="_blank" rel="noopener noreferrer">
                      {msg.fileName}
                    </a>
                  ) : (
                    <img src={`${BASE_URL}/uploads/${msg.fileName}`} alt="File" />
                  )
                )}
              </div>
            ))}
          </div>
          <div className="input-container">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={sendMessage} // Trigger sendMessage on Enter key press
              placeholder="Enter Message"
              className="message-input"
            />
            <button onClick={sendMessage} className="send-button">Send</button>
          </div>
          <div className="file-input-container">
            <input
              type="file"
              onChange={(e) => setFile(e.target.files[0])}
              className="file-input"
            />
            <button onClick={sendFile} className="send-button">Send File</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
