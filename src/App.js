import React, { useEffect } from "react";
import "./App.css";
import socketIOClient from "socket.io-client";

function App() {
  useEffect(() => {
    const socket = socketIOClient("http://localhost:3001");
    socket.on();
  }, []);
  return <div className="App">hai</div>;
}

export default App;
