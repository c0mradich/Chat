import {useRef, useState} from "react"
import { Dialog, DialogTitle, DialogActions, Button } from '@mui/material';

const apiURL = process.env.NEXT_PUBLIC_API_URL

export function Messages({ messages, name, handleSendMessage,  setNewMessage, setEditingMsgId}) {
  const [open, setOpen] = useState(false);
  const [selectedMsg, setSelectedMsg] = useState(null);

  function handleOpenPopup(msg) {
    setSelectedMsg(msg);
    setOpen(true);
  }

  function handleClosePopup() {
    setOpen(false);
    setSelectedMsg(null);
  }

  function handleDelete() {
    handleSendMessage({selectedMsg}, 'delete_msg')
    handleClosePopup();
  }

  function handleEdit() {
    if(name===selectedMsg.sender){
      setEditingMsgId(selectedMsg.id)
      setNewMessage(selectedMsg.text)
    }
    handleClosePopup();
  }

  function renderContent(msg) {
  const { content, text } = msg;

  if (!content) return <div className="message-text">{text}</div>;

  // Проверяем base64
  if (typeof content === 'string' && content.startsWith('data:')) {
    try {
      const [metadata, base64Data] = content.split(',');
      const mime = metadata.split(':')[1]?.split(';')[0] || '';
      if (mime.startsWith('image/')) return <img src={content} alt="file" className="message-image" />;
      if (mime.startsWith('audio/')) return <audio controls src={content} />;
      if (mime.startsWith('video/')) return <video controls src={content} />;
      return <a href={content} download>Download file</a>;
    } catch (err) {
      console.warn("Ошибка при рендере base64:", err);
      return <div className="message-text">{text}</div>;
    }
  }

  // Ссылка на серверный файл
  const url = typeof content === 'string' ? `${apiURL}/${encodeURI(content)}` : '';
  const ext = url.split('.').pop()?.toLowerCase() || '';

  const fileTypes = {
    images: ['png','jpg','jpeg','gif','webp'],
    audios: ['mp3','wav','ogg'],
    videos: ['mp4','webm','mov']
  };

  if (fileTypes.images.includes(ext)) return <img src={url} alt="file" className="message-image" />;
  if (fileTypes.audios.includes(ext)) return <audio controls src={url} />;
  if (fileTypes.videos.includes(ext)) return <video controls src={url} />;
  
  return <a href={url} download>Download file</a>;
}


  return (
    <div className="messages">
{messages.map((msg, index) => {
    const isMe = msg.sender === name;
    const displayName = isMe ? 'You' : msg.sender;
    const prevMsg = messages[index - 1];
    const sameSenderAsPrev = prevMsg && prevMsg.sender === msg.sender;

    // Проверяем разницу во времени
    let timeGap = true;
    if (prevMsg) {
        const prevTime = new Date(prevMsg.timestamp);
        const currTime = new Date(msg.timestamp);

        const diffMs = currTime - prevTime;
        const diffMinutes = diffMs / 1000 / 60;

        timeGap = diffMinutes > 1;
    }

    const shouldShowSender = !sameSenderAsPrev || timeGap;

    return (
        <div
            key={index}
            className={`message ${isMe ? 'sent' : 'received'}`}
            onContextMenu={(e) => {
                e.preventDefault();
                handleOpenPopup(msg);
            }}
            style={{ cursor: 'pointer' }}
        >
            {displayName === null ? (
                <div className="system-message">{msg.text}</div>
            ) : (
                <>
                    {shouldShowSender && (
                        <div className="message-sender">
                            <span>{displayName}</span>  {' ' + new Date(msg.timestamp).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit'
                            })}
                        </div>
                    )}

                    {msg.content && msg.content.trim() !== '' ? (
                        renderContent(msg)
                    ) : (
                        <div className="message-text">{msg.text}</div>
                    )}
                </>
            )}
        </div>
    );
})}

<Dialog
  open={open}
  onClose={handleClosePopup}
  sx={{
    '& .MuiPaper-root': {
      background: '#2b2d31', 
      color: '#f2f3f5',
      borderRadius: '10px',
      padding: '10px 0',
      boxShadow: '0 0 25px rgba(0,0,0,0.45)',
      minWidth: '340px',
      border: '1px solid #1e1f22'
    },

    '& .MuiDialogTitle-root': {
      fontSize: '18px',
      fontWeight: 600,
      padding: '14px 20px',
      borderBottom: '1px solid #1e1f22',
      color: '#f2f3f5'
    },

    '& .MuiDialogActions-root': {
      background: 'rgba(22, 9, 9, 0.05)',
      display: 'flex',
      gap: '10px'
    },

    '& .MuiButton-root': {
      textTransform: 'lowercase',
      fontSize: '14px',
      fontWeight: 600,
      borderRadius: '6px',
      padding: '8px 16px',
      transition: '0.15s ease',
    },

    '& .MuiButton-root:hover': {
      opacity: 0.9
    },

    '& .MuiButton-colorPrimary': {
      background: '#5865f2',          // Discord blurple
      color: '#fff'
    },

    '& .MuiButton-colorError': {
      background: '#ed4245',          // Discord red
      color: '#fff'
    },

    '& .MuiButton-text': {
      background: '#4f545c',          // Discord gray button
      color: '#fff'
    },

    '& .MuiButton-text:hover': {
      background: '#5a5f66'
    }
  }}
>

        <DialogTitle>Message Options</DialogTitle>
        <DialogActions>
          {name === selectedMsg?.sender && (
            <>
              <Button onClick={handleEdit} color="primary">Edit</Button>
            </>
          )}
        <Button
          onClick={() => {navigator.clipboard.writeText(selectedMsg.text);handleClosePopup();}}>
          Copy
        </Button>
          <Button onClick={handleDelete} color="error">Delete</Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}