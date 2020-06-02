import React, { useEffect, useState, useReducer, useRef } from "react";
import "./App.css";
import io from "socket.io-client";
import Peer from "simple-peer";
// import StateContext from "./stateContext";

function App() {
  const [yourID, setYourID] = useState("");
  const [users, setUsers] = useState({});
  const [webcamStream, setStream] = useState();
  const [partnerStream, setPartnerStream] = useState();
  const [callAccepted, setCallAccepted] = useState(false);
  const [showUsers, setShowUsers] = useState(false);

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
      case "BOTH_PARTIES_ACCEPTED_CALL":
        return {
          ...state,
          receivingCall: false,
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

  const handleCloseReceivingCallAlert = () => {
    dispatchCurrentStates({ type: "BOTH_PARTIES_ACCEPTED_CALL" });
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
      // console.log("initial useEffect: ", userVideo);
      setUsers(users);
    });

    socket.current.on("hey", (data) => {
      console.log("hey");
      handleReceivingCall(data);
    });
  }, []);

  /**
   * when setUsers was called, the state of webcamStream was referred from its initial state
   * so I have this useEffect below to set the ref to the current webcamStream state
   */
  // useEffect(() => {
  //   if (userVideo.current) {
  //     userVideo.current.srcObject = webcamStream;
  //   }
  //   if (partnerVideo.current) {
  //     partnerVideo.current.srcObject = partnerStream;
  //   }
  //   // eslint-disable-next-line
  // }, [users, receivingCall, caller, callerSignal, callAccepted, showUsers]);

  useEffect(() => {});

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
      console.log("emit callUser");
      socket.current.emit("callUser", {
        userToCall: id,
        signalData: data,
        from: yourID,
      });
    });

    peer.on("stream", (stream) => {
      if (partnerVideo.current) {
        partnerVideo.current.srcObject = stream;
      }
    });

    socket.current.on("callAccepted", (signal) => {
      setShowUsers(false);
      setCallAccepted(true);
      // handleCloseReceivingCallAlert();
      peer.signal(signal);
    });
  };

  /**
   * accept incoming call
   */
  const acceptCall = () => {
    setCallAccepted(true);
    setShowUsers(false);

    handleCloseReceivingCallAlert();

    const peer = new Peer({
      initiator: false,
      trickle: false,
      stream: webcamStream,
    });

    peer.on("signal", (data) => {
      socket.current.emit("acceptCall", {
        signal: data,
        to: caller,
      });
    });

    peer.on("stream", (stream) => {
      setPartnerStream(stream);
    });

    peer.signal(callerSignal);
  };

  const UserVideo = () => {
    useEffect(() => {
      userVideo.current.srcObject = webcamStream;
    });

    return (
      <video
        className="user-webcam"
        playsInline
        muted
        ref={userVideo}
        autoPlay
      />
    );
  };

  const PartnerVideo = () => {
    return (
      <video
        className="partner-webcam"
        playsInline
        ref={partnerVideo}
        autoPlay
      />
    );
  };

  let IncomingCall = () => {
    return (
      <div className="receiving-call card">
        <div className="card-body">
          <h5 className="card-title">{caller} is calling you</h5>
          <button
            type="button"
            className="btn btn-outline-success"
            onClick={acceptCall}
          >
            Accept
          </button>
        </div>
      </div>
    );
  };

  const usersList = Object.keys(users).map((key) => {
    if (key === yourID) {
      return null;
    }
    return (
      <button
        type="button"
        className="btn btn-outline-success"
        key={key}
        onClick={() => callPeer(key)}
      >
        Call {key}
      </button>
    );
  });

  // useEffect(() => console.log({ yourID }), [yourID]);

  // useEffect(() => console.log({ currentStates }), [currentStates]);

  // useEffect(() => console.log({ webcamStream }), [webcamStream]);

  const partnerBox = useRef(null);

  const handleMovePartnerVideo = (e) => {
    const touchLocation = e.targetTouches[0];
    // - 50 to auto center users finger on box location
    partnerBox.current.style.left = `${touchLocation.pageX - 50}px`;
    partnerBox.current.style.top = `${touchLocation.pageY - 100}px`;
  };

  return (
    <div className="App">
      <button
        type="button"
        id="online-users-btn"
        className="btn btn-outline-dark"
        onClick={(e) => setShowUsers(!showUsers)}
      >
        {!showUsers ? "Online Users" : "Video Chat"}
      </button>
      {!showUsers ? (
        <div className="videos">
          {/* <div className="user-video">{webcamStream && <UserVideo />}</div> */}
          <div className="user-video">{userVideo && <UserVideo />}</div>

          <div
            className="partner-video"
            ref={partnerBox}
            onTouchMove={(e) => {
              handleMovePartnerVideo(e);
            }}
          >
            {callAccepted && <PartnerVideo />}
          </div>
          {/* <div
            className="partner-box"
            ref={partnerBox}
            // onTouchMove is for mobile
            onTouchMove={(e) => {
              handleMovePartnerVideo(e);
            }}
          ></div> */}
        </div>
      ) : (
        <div className="users-call-view">
          <div className="users">
            <h3>Online Users:</h3>
            {usersList}
          </div>
          {receivingCall && <IncomingCall />}
        </div>
      )}
    </div>
  );
}

export default App;
