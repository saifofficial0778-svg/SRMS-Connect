import { useEffect, useState } from "react";
import { io } from "socket.io-client";

const socket = io("http://localhost:5000", {
    auth: {
        token: localStorage.getItem("token")
    }
});

function Chat() {
    const [conversationId, setConversationId] = useState(1);
    const [message, setMessage] = useState("");
    const [messages, setMessages] = useState([]);

    useEffect(() => {
 
        socket.on("connect", () => {
            console.log("Connected:", socket.id);
        });

        socket.on("new_message", (data) => {
            setMessages((prev) => [...prev, data]);
        });

        socket.on("message_sent", (data) => {
            setMessages((prev) => [...prev, data]);
        });

        socket.on("message_error", (error) => {
            console.log(error.message);
        });

        return () => {
            socket.off("connect");
            socket.off("new_message");
            socket.off("message_sent");
            socket.off("message_error");
        };

    }, []);

    const sendMessage = () => {
        if (!message.trim()) return;

        socket.emit("send_message", {
            conversationId,
            content: message
        });

        setMessage("");
    };

    return (
        <div>
            <h2>Chat</h2>

            <div>
                {messages.map((msg, index) => (
                    <p key={index}>
                        {msg.content}
                    </p>
                ))}
            </div>

            <input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Type message..."
            />

            <button onClick={sendMessage}>
                Send
            </button>
        </div>
    );
}

export default Chat;