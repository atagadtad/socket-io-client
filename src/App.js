import React, { useEffect, useState, useReducer } from "react";
import "./App.css";
import io from "socket.io-client";
import Peer from "simple-peer";
import StateContext from "./StateContext";

function App() {
  const [yourID, setYourID] = useState("");
  const [users, setUsers] = useState({});
  const [stream, setStream] = useState(null);
  const [callAccepted, setCallAccepted] = useState(false);

  const initialStates = {
    receivingCall: false,
    caller: "",
    callerSignal: null,
  };

  const stateReducer = (state, action) => {
    switch (action.type) {
      case "SOMEONE_IS_CALLING_YOU":
        return {
          ...state,
          receivingCall: true,
          caller: action.data.from,
          callerSignal: action.data.signal,
        };
      default:
        throw new Error(
          `Tried to reduce with unsupported action type: ${action.type}`
        );
    }
  };

  const [currentStates, dispatchCurrentStates] = useReducer(
    stateReducer,
    initialStates
  );

  const receivingCall = currentStates.receivingCall;
  const caller = currentStates.caller;
  const callerSignal = currentStates.callerSignal;

  const handleReceivingCall = (data) => {
    dispatchCurrentStates({ type: "SOMEONE_IS_CALLING_YOU", data });
  };

  const userVideo = useRef();
  const partnerVideo = useRef();
  const socket = useRef();

  useEffect(() => {
    socket.current = io.connect("/");
    navigator.mediaDevices
      .getUserMedia({
        video: true,
        audio: true,
      })
      .then((stream) => {
        setStream(stream);
        if (userVideo.current) {
          userVideo.current.srcObject = stream;
        }
      });

    socket.current.on("yourID", (id) => {
      setYourID(id);
    });
    socket.current.on("allUsers", (users) => {
      setUsers(users);
    });

    socket.current.on("hey", (data) => {
      handleReceivingCall(data);
    });
  }, []);

  return (
    <div className="App">
      <h1>hello world</h1>
    </div>
  );
}

export default App;
