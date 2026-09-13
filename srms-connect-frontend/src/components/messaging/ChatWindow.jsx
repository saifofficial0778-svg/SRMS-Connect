import ChatHeader from "./ChatHeader";
import MessageList from "./MessageList";
import MessageComposer from "./MessageComposer";

export default function ChatWindow({
  conversation,
  online,
  isTyping,
  messages,
  loadingMessages,
  sendError,
  currentUserId,
  onSend,
  onRetryMessage,
  onTypingStart,
  onTypingStop,
  onBack,
}) {
  return (
    <div className="flex-1 flex flex-col min-h-0 bg-white">
      <ChatHeader
        otherUser={conversation.otherUser}
        online={online}
        isTyping={isTyping}
        onBack={onBack}
      />

      <MessageList
        messages={messages}
        loading={loadingMessages}
        currentUserId={currentUserId}
        onRetryMessage={onRetryMessage}
      />

      {sendError && (
        <p className="px-4 pb-1 text-xs text-[#B3432B]">{sendError}</p>
      )}

      <MessageComposer onSend={onSend} onTypingStart={onTypingStart} onTypingStop={onTypingStop} />
    </div>
  );
}
