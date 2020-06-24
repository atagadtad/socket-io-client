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
  const [callDeclined, setCallDeclined] = useState(false);
  const [awaitingResponse, setAwaitingResponse] = useState(false);
  const [showUsers, setShowUsers] = useState(false);

  const initialStates = {
    receivingCall: false,
    caller: "",
    callerSignal: null,
    endCall: false,
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
      case "USER_YOU_ARE_CALLING":
        return {
          ...state,
          caller: action.id,
        };
      case "BOTH_PARTIES_ACCEPTED_CALL":
        return {
          ...state,
          receivingCall: false,
        };
      case "END_CALL":
        return {
          ...state,
          receivingCall: false,
          caller: "",
          callerSignal: null,
          endCall: true,
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
  // const endCall = currentStates.endCall;

  const handleReceivingCall = (data) => {
    dispatchCurrentStates({ type: "SOMEONE_IS_CALLING_YOU", data });
  };

  const setUserYouAreCalling = (id) => {
    // console.log({ id }, "setUserYouArecalling");
    dispatchCurrentStates({ type: "USER_YOU_ARE_CALLING", id });
  };

  const handleCloseReceivingCallAlert = () => {
    dispatchCurrentStates({ type: "BOTH_PARTIES_ACCEPTED_CALL" });
  };

  const handleEndCall = () => {
    dispatchCurrentStates({ type: "END_CALL" });
  };

  const userVideo = useRef();
  const partnerVideo = useRef();
  const socket = useRef();

  useEffect(() => {
    // socket.current = io("https://socket-video-atags.herokuapp.com/");
    socket.current = io("http://localhost:8000");

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

    // socket.current.on("endOrRejectCall", () => {
    //   console.log("ending call");
    // });

    socket.current.on("hey", (data) => {
      handleReceivingCall(data);
    });
  }, []);

  useEffect(() => console.log({ users }), [users]);

  /**
   * call a user
   */
  const callPeer = (id) => {
    setUserYouAreCalling(id);
    let peer;
    peer = new Peer({
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
      if (partnerVideo.current) {
        partnerVideo.current.srcObject = stream;
      }
    });

    socket.current.on("callAccepted", (signal) => {
      setShowUsers(false);
      setCallAccepted(true);
      setAwaitingResponse(false);
      if (peer.destroyed) {
        peer = new Peer({
          initiator: true,
          trickle: false,
          stream: webcamStream,
        });
      }
      peer.signal(signal);
    });

    socket.current.on("callDeclined", (data) => {
      // console.log({ data });
      if (data.callDeclined) {
        // change state so notification alerts user that call declined
        console.log("CALL DECLINED!");
        setCallDeclined(true);
        // setAwaitingResponse(false);
      }
    });

    socket.current.on("endCall", () => {
      // console.log("endCall on callPeer func.");
      peer.removeAllListeners();
      peer.destroy();
      // window.location.reload();
      setCallAccepted(false);
      handleEndCall();
    });
  };

  // console.log({ currentStates });

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

    // console.log("acceptCall: ", { peer });

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

    socket.current.on("endCall", () => {
      // console.log("endCall on acceptCall func.");
      peer.removeAllListeners();
      peer.destroy();
      // console.log("reload?");
      // window.location.reload();
      setCallAccepted(false);
      handleEndCall();
    });
  };

  const closeAndEndCall = () => {
    // console.log({ yourID }, { caller });
    socket.current.emit("endTheCall", {
      from: yourID,
      to: caller,
    });
    // handleEndCall();
  };

  const declineCall = () => {
    handleCloseReceivingCallAlert();

    socket.current.emit("declineCall", {
      from: caller,
    });
    // let other user know you declined the call
  };

  const UserVideo = () => {
    useEffect(() => {
      if (userVideo.current) {
        userVideo.current.srcObject = webcamStream;
        // console.log(userVideo);
      }
    });
    return (
      <video
        className={callAccepted ? `partner-webcam` : `user-webcam`}
        playsInline
        muted
        ref={userVideo}
        autoPlay
      />
    );
  };

  const PartnerVideo = () => {
    useEffect(() => {
      if (partnerVideo.current) {
        partnerVideo.current.srcObject = partnerStream;
      }
    });

    return (
      <video
        className={callAccepted ? `user-webcam` : `partner-webcam`}
        playsInline
        ref={partnerVideo}
        autoPlay
      />
    );
  };

  const IncomingCall = () => {
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
          <button
            type="button"
            className="btn btn-outline-danger"
            onClick={declineCall}
          >
            Decline
          </button>
        </div>
      </div>
    );
  };

  const CallLoadingScreen = () => {
    return (
      <div className="card">
        <div className="card-body">
          <h5 className="card-title">
            {callDeclined ? `Call Declined` : `Awaiting Response`}
          </h5>
          {callDeclined && (
            <button
              type="button"
              className="btn btn-outline-danger"
              onClick={() => {
                setAwaitingResponse(false);
                setCallDeclined(false);
              }}
            >
              Close
            </button>
          )}
        </div>
      </div>
    );
  };

  // const usersList = Object.keys(users).map((key) => {
  //   if (key === yourID) {
  //     return null;
  //   }
  //   return (
  //     <button
  //       type="button"
  //       className="btn btn-outline-success"
  //       key={key}
  //       onClick={() => {
  //         callPeer(key);
  //         setAwaitingResponse(true);
  //       }}
  //     >
  //       Call {key}
  //     </button>
  //   );
  // });

  const usersList = Object.entries(users).map((user, i) => {
    if (user[0] === yourID) {
      return null;
    }
    console.log({ user });
    return (
      <button
        type="button"
        className="btn btn-outline-success"
        key={user[0]}
        onClick={() => {
          callPeer(user[0]);
          setAwaitingResponse(true);
        }}
      >
        Call {user[0]}
      </button>
    );
  });

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
          <div
            className={callAccepted ? `partner-video` : `user-video`}
            ref={callAccepted ? partnerBox : null}
          >
            {webcamStream && <UserVideo />}
          </div>

          <div
            className={callAccepted ? `user-video` : `partner-video`}
            // ref={partnerBox}
            onTouchMove={(e) => {
              handleMovePartnerVideo(e);
            }}
          >
            {callAccepted && <PartnerVideo />}
            {callAccepted && (
              <button
                type="button"
                className="btn btn-outline-danger end-call"
                onClick={closeAndEndCall}
              >
                END CALL
              </button>
            )}
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
          {awaitingResponse && <CallLoadingScreen />}
        </div>
      )}
    </div>
  );
}

export default App;
