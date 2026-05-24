use tokio::io::{self, AsyncReadExt, AsyncWriteExt};
use serde::{Serialize, de::DeserializeOwned};

/// Reads a single native messaging frame from standard input.
/// Format: 4-byte length prefix (native endian) + UTF-8 JSON payload.
pub async fn read_message<T: DeserializeOwned>() -> Result<T, std::io::Error> {
    let mut stdin = io::stdin();
    
    // Read 4-byte length header
    let mut length_bytes = [0u8; 4];
    stdin.read_exact(&mut length_bytes).await?;
    
    let length = u32::from_ne_bytes(length_bytes) as usize;
    if length == 0 {
        return Err(std::io::Error::new(std::io::ErrorKind::UnexpectedEof, "Empty message length"));
    }

    // Read payload
    let mut buffer = vec![0u8; length];
    stdin.read_exact(&mut buffer).await?;
    
    // Deserialize JSON
    let message: T = serde_json::from_slice(&buffer)
        .map_err(|e| std::io::Error::new(std::io::ErrorKind::InvalidData, e))?;
        
    Ok(message)
}

/// Writes a single native messaging frame to standard output.
/// Format: 4-byte length prefix (native endian) + UTF-8 JSON payload.
pub async fn write_message<T: Serialize>(message: &T) -> Result<(), std::io::Error> {
    let mut stdout = io::stdout();
    
    // Serialize to JSON vector
    let payload = serde_json::to_vec(message)
        .map_err(|e| std::io::Error::new(std::io::ErrorKind::InvalidData, e))?;
        
    let length = payload.len() as u32;
    let length_bytes = length.to_ne_bytes();
    
    // Write 4-byte header and payload
    stdout.write_all(&length_bytes).await?;
    stdout.write_all(&payload).await?;
    stdout.flush().await?;
    
    Ok(())
}
