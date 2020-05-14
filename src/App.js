import React, { useEffect } from "react";
import "./App.css";
import io from "socket.io-client";
import Peer from "simple-peer";

function App() {
  useEffect(() => {
    const socket = socketIOClient("http://localhost:3001");
    socket.on("notifications_1", (msg) => {
      console.log({ msg });
    });
  }, []);

  useEffect(() => {});

  return (
    <div className="App">
      <h1>hello world</h1>
    </div>
  );
}

export default App;
