import React, { useEffect, useState, useReducer, useRef } from "react";
import "./App.css";
import io from "socket.io-client";
import Peer from "simple-peer";
// import StateContext from "./stateContext";

function App() {
  const [yourID, setYourID] = useState("");
  const [users, setUsers] = useState({});
  const [webcamStream, setStream] = useState();
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
    socket.current = io("https://socket-video-atags.herokuapp.com/");
    // socket.current = io("http://localhost:8000");

    navigator.mediaDevices
      .getUserMedia({
        video: true,
        audio: true,
      })
      .then((webcamStream) => {
        setStream(webcamStream);
        // console.log({ webcamStream });
        // if (userVideo.current) {
        userVideo.current.srcObject = webcamStream;
        // }
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

  /**
   * call a user
   */
  const callPeer = (id) => {
    const peer = new Peer({
      initiator: true,
      trickle: false,
      stream: webcamStream,
    });

    peer.on("signal", (data) => {
      socket.current.emit("callUser", {
        userToCall: id,
        signalData: data,
        from: yourID,
      });
    });

    peer.on("stream", (stream) => {
      // if (partnerVideo.current) {
      partnerVideo.current.srcObject = stream;
      userVideo.current.srcObject = webcamStream;
      console.log("partnerVideo:", partnerVideo);
      console.log("userVideo:", userVideo);
      // }
    });

    socket.current.on("callAccepted", (signal) => {
      setCallAccepted(true);
      peer.signal(signal);
    });
  };

  /**
   * accept incoming call
   */
  const acceptCall = () => {
    setCallAccepted(true);

    const peer = new Peer({
      initiator: false,
      tricle: false,
      stream: webcamStream,
    });

    peer.on("signal", (data) => {
      socket.current.emit("acceptCall", {
        signal: data,
        to: caller,
      });
    });

    peer.on("stream", (stream) => {
      partnerVideo.current.srcObject = stream;
    });

    peer.signal(callerSignal);
  };

  const UserVideo = () => {
    return <video playsInline muted ref={userVideo} autoPlay />;
  };

  const PartnerVideo = () => {
    return <video playsInline muted ref={partnerVideo} autoPlay />;
  };

  let IncomingCall = () => {
    return (
      <div>
        <h1>{caller} is calling you</h1>
        <button onClick={acceptCall}>Accept</button>
      </div>
    );
  };

  const usersList = Object.keys(users).map((key) => {
    if (key === yourID) {
      return null;
    }
    return (
      <button key={key} onClick={() => callPeer(key)}>
        Call {key}
      </button>
    );
  });

  // console.log({ currentStates });

  // useEffect(() => {
  //   if (userVideo.current !== undefined) {
  //     console.log(userVideo.current.srcObject);
  //   }
  // }, [userVideo.current]);

  // useEffect(() => {
  //   if (partnerVideo.current !== undefined) {
  //     console.log(partnerVideo.current.srcObject);
  //   }
  // }, [partnerVideo.current]);

  // console.log({ userVideo, partnerVideo });

  return (
    <div className="App">
      <div className="videos">
        <div>
          <h1>ME:</h1>
          {webcamStream && <UserVideo />}
        </div>
        <div>
          <h1>OTHER:</h1>
          {callAccepted && <PartnerVideo />}
        </div>
      </div>
      <div className="users">{usersList}</div>
      <div>{receivingCall && <IncomingCall />}</div>
    </div>
  );
}

export default App;
