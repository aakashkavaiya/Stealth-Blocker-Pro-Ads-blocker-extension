use serde::{Deserialize, Serialize};
use std::error::Error;

mod bridge;
mod uncloaker;
mod dns_firewall;

use uncloaker::CnameUncloaker;
use dns_firewall::DnsFirewall;

// Define expected incoming messaging JSON payload structures
#[derive(Deserialize, Debug)]
#[serde(tag = "action")]
enum IncomingRequest {
    #[serde(rename = "resolve_cname")]
    ResolveCname { domain: String },
    #[serde(rename = "ping")]
    Ping,
}

// Define outgoing messaging structures
#[derive(Serialize, Debug)]
#[serde(tag = "type")]
enum OutgoingResponse {
    #[serde(rename = "cname_resolution")]
    CnameResolution {
        domain: String,
        resolved_cname: String,
        is_tracker: bool,
    },
    #[serde(rename = "pong")]
    Pong,
    #[serde(rename = "error")]
    Error { message: String },
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn Error>> {
    // Standard Chrome Native Messaging stdout/stdin is binary,
    // so we must avoid normal print! or println! macros which corrupt standard output stream.
    // Standard I/O uses our tokio-based bridge module.
    
    let uncloaker = CnameUncloaker::new();
    let firewall = DnsFirewall::new();

    // Loop continuously reading requests from standard input
    loop {
        match bridge::read_message::<IncomingRequest>().await {
            Ok(request) => {
                match request {
                    IncomingRequest::ResolveCname { domain } => {
                        // First, check if the domain is explicitly blocked by local firewall
                        if firewall.check_doh_threat(&domain) {
                            let response = OutgoingResponse::CnameResolution {
                                domain: domain.clone(),
                                resolved_cname: "blocked_by_dns_firewall".to_string(),
                                is_tracker: true,
                            };
                            let _ = bridge::write_message(&response).await;
                            continue;
                        }

                        // Otherwise, query the async uncloaker
                        match uncloaker.resolve(&domain).await {
                            Some((cname, is_tracker)) => {
                                let response = OutgoingResponse::CnameResolution {
                                    domain,
                                    resolved_cname: cname,
                                    is_tracker: is_tracker || firewall.check_doh_threat(&domain),
                                };
                                let _ = bridge::write_message(&response).await;
                            }
                            None => {
                                // Domain resolved without a CNAME record or resolve failed.
                                // We report it back as benign/empty CNAME uncloaking
                                let response = OutgoingResponse::CnameResolution {
                                    domain: domain.clone(),
                                    resolved_cname: "".to_string(),
                                    is_tracker: firewall.check_doh_threat(&domain),
                                };
                                let _ = bridge::write_message(&response).await;
                            }
                        }
                    }
                    IncomingRequest::Ping => {
                        let response = OutgoingResponse::Pong;
                        let _ = bridge::write_message(&response).await;
                    }
                }
            }
            Err(e) => {
                // If stream hits UnexpectedEof, this means the Chrome extension terminated the port.
                // We exit cleanly.
                if e.kind() == std::io::ErrorKind::UnexpectedEof {
                    break;
                }
                
                // Write error response back to Chrome console if possible
                let err_response = OutgoingResponse::Error {
                    message: format!("Error reading message: {}", e),
                };
                let _ = bridge::write_message(&err_response).await;
            }
        }
    }

    Ok(())
}
