use trust_dns_resolver::TokioAsyncResolver;
use trust_dns_resolver::config::{ResolverConfig, ResolverOpts};
use std::sync::Arc;

// Simple internal list of tracker keywords for testing and uncloaking matching
const TRACKER_KEYWORDS: &[&str] = &[
  "analytics",
  "telemetry",
  "tracker",
  "doubleclick",
  "googleadservices",
  "scorecardresearch",
  "adnxs",
  "adserver",
  "adsystem",
  "popads",
  "metrics",
  "marketing",
  "tracking"
];

pub struct CnameUncloaker {
    resolver: TokioAsyncResolver,
}

impl CnameUncloaker {
    pub fn new() -> Self {
        // Initialize async resolver with Google DNS and default options
        let config = ResolverConfig::google();
        let mut opts = ResolverOpts::default();
        opts.cache_size = 1000; // Cache DNS queries
        
        let resolver = TokioAsyncResolver::tokio(config, opts).expect("Failed to initialize resolver");
        
        CnameUncloaker { resolver }
    }

    /// Recursively resolve CNAME records for a domain to uncloak potential trackers.
    pub async fn resolve(&self, domain: &str) -> Option<(String, bool)> {
        // Query CNAME records
        // Under trust-dns-resolver, querying RecordType::CNAME yields CNAME results if they exist.
        match self.resolver.cname_lookup(domain).await {
            Ok(lookup) => {
                // Get the first resolved canonical name in the chain
                if let Some(cname_record) = lookup.iter().next() {
                    let resolved = cname_record.to_utf8().trim_end_matches('.').to_string();
                    let is_tracker = self.check_is_tracker(&resolved);
                    return Some((resolved, is_tracker));
                }
            }
            Err(e) => {
                // If domain has no CNAME, standard lookup might fail or return no records, which is fine
                log_debug(&format!("CNAME resolution failed for {}: {:?}", domain, e));
            }
        }
        
        None
    }

    /// Check if the canonical name matches known tracking patterns
    fn check_is_tracker(&self, resolved_name: &str) -> bool {
        let name_lower = resolved_name.to_lowercase();
        for keyword in TRACKER_KEYWORDS {
            if name_lower.contains(keyword) {
                return true;
            }
        }
        false
    }
}

// Simple internal log helper
fn log_debug(_msg: &str) {
    // In production we can log to a local file, stdout is reserved for Native Messaging JSON
}
