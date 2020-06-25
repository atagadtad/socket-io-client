import React, { useEffect, useState, useReducer, useRef } from "react";
import "./App.css";
import io from "socket.io-client";
import Peer from "simple-peer";

// ChangeUserName outisde of App because it's a form component
const ChangeUserName = (props) => {
  return (
    <form onSubmit={props.handleSubmitUsername}>
      <div className="form-group">
        <label htmlFor="exampleInputEmail1">Username</label>
        <input
          type="text"
          className="form-control"
          id="exampleInputEmail1"
          placeholder="Enter your new username"
          onChange={(e) => props.setUsernameInput(e.target.value)}
          value={props.usernameInput}
        />
      </div>

      <button type="submit" className="btn btn-primary">
        Submit
      </button>
    </form>
  );
};

function App() {
  const [yourID, setYourID] = useState("");
  const [users, setUsers] = useState({});
  const [webcamStream, setStream] = useState();
  const [partnerStream, setPartnerStream] = useState();
  const [callAccepted, setCallAccepted] = useState(false);
  const [callDeclined, setCallDeclined] = useState(false);
  const [awaitingResponse, setAwaitingResponse] = useState(false);
  const [showUsers, setShowUsers] = useState(false);
  const [usernameInput, setUsernameInput] = useState("");
  const [username, setUsername] = useState("");

  const initialStates = {
    receivingCall: false,
    caller: "",
    callerSignal: null,
    endCall: false,
    callerUsername: "",
  };

  const stateReducer = (state, action) => {
    switch (action.type) {
      case "SOMEONE_IS_CALLING_YOU":
        return {
          ...state,
          receivingCall: true,
          caller: action.data.from,
          callerSignal: action.data.signal,
          callerUsername: action.data.fromUsername,
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
          callerUsername: "",
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
  const callerUsername = currentStates.callerUsername;
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

    socket.current.on("updatedUsername", (data) => {
      // console.log({ data });
      setUsername(data.updatedUsername);
    });

    socket.current.on("hey", (data) => {
      handleReceivingCall(data);
    });
  }, []);

  useEffect(() => {
    // console.log({ users });
    // if (users !== {} && users[yourID] !== undefined) {
    //   console.log(users[yourID].userName === "");
    // }
  }, [users]);

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
        fromUsername: username,
        // from: username,
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
          <h5 className="card-title">{callerUsername} is calling you</h5>
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

  const usersList = Object.entries(users).map((user) => {
    if (user[0] === yourID) {
      return null;
    }
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
        Call {user[1].userName}
      </button>
    );
  });

  // useEffect(() => console.log(usernameInput), [usernameInput]);

  const partnerBox = useRef(null);

  const handleMovePartnerVideo = (e) => {
    const touchLocation = e.targetTouches[0];
    // - 50 to auto center users finger on box location
    partnerBox.current.style.left = `${touchLocation.pageX - 50}px`;
    partnerBox.current.style.top = `${touchLocation.pageY - 100}px`;
  };

  const handleSubmitUsername = (e) => {
    e.preventDefault();
    socket.current.emit("changeUsername", {
      updatedUsername: usernameInput,
    });
  };

  return (
    <div className="App">
      {username === "" ? (
        <ChangeUserName
          usernameInput={usernameInput}
          setUsernameInput={setUsernameInput}
          handleSubmitUsername={handleSubmitUsername}
        />
      ) : (
        <>
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
            </div>
          ) : (
            <div className="users-call-view">
              <div className="users">
                <h3>Online Users:</h3>
                {usersList}
                <h5>Username: {username}</h5>
              </div>
              {receivingCall && <IncomingCall />}
              {awaitingResponse && <CallLoadingScreen />}
              <ChangeUserName
                usernameInput={usernameInput}
                setUsernameInput={setUsernameInput}
                handleSubmitUsername={handleSubmitUsername}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default App;
