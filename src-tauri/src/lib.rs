use std::collections::HashMap;

#[derive(serde::Serialize)]
struct OpenFileData {
    pub filename: String,
    pub data: String,
    pub ext: String,
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct MetadataHttpRequest {
    pub url: String,
    pub method: Option<String>,
    pub headers: Option<HashMap<String, String>>,
    pub body: Option<String>,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct MetadataHttpResponse {
    pub status: u16,
    pub body: String,
    pub content_type: Option<String>,
}

#[tauri::command]
fn get_open_file_data() -> Option<OpenFileData> {
    let filename = std::env::args().nth(1);
    if let Some(filename) = filename {
        let path = std::path::Path::new(&filename);
        let ext = path
            .extension()
            .map(|x| x.to_string_lossy().into_owned())
            .unwrap_or_default();
        if let Ok(data) = std::fs::read_to_string(&filename) {
            return Some(OpenFileData {
                filename,
                data,
                ext,
            });
        }
    }

    None
}

#[tauri::command]
async fn metadata_http_request(
    request: MetadataHttpRequest,
) -> Result<MetadataHttpResponse, String> {
    let (url, method) = validate_metadata_http_request(&request)?;
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|err| err.to_string())?;
    let mut builder = client.request(method, url);

    for (key, value) in filter_metadata_headers(request.headers.as_ref()) {
        let name = reqwest::header::HeaderName::from_bytes(key.as_bytes())
            .map_err(|err| err.to_string())?;
        let value = reqwest::header::HeaderValue::from_str(value).map_err(|err| err.to_string())?;
        builder = builder.header(name, value);
    }

    if let Some(body) = request.body {
        builder = builder.body(body);
    }

    let response = builder.send().await.map_err(|err| err.to_string())?;
    let status = response.status().as_u16();
    let content_type = response
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .map(std::string::ToString::to_string);
    let body = response.text().await.map_err(|err| err.to_string())?;

    Ok(MetadataHttpResponse {
        status,
        body,
        content_type,
    })
}

fn validate_metadata_http_request(
    request: &MetadataHttpRequest,
) -> Result<(reqwest::Url, reqwest::Method), String> {
    let url = reqwest::Url::parse(&request.url).map_err(|_| "URL is invalid".to_string())?;
    let scheme = url.scheme();
    let host = url.host_str().unwrap_or_default();
    if scheme != "https" {
        return Err("Protocol is not allowed".to_string());
    }
    if !metadata_host_allowed(host) {
        return Err("Host is not allowed".to_string());
    }
    let method_text = request
        .method
        .as_deref()
        .unwrap_or("GET")
        .to_ascii_uppercase();
    let method = match method_text.as_str() {
        "GET" => reqwest::Method::GET,
        "POST" => reqwest::Method::POST,
        _ => return Err("Method is not allowed".to_string()),
    };
    if request
        .body
        .as_ref()
        .is_some_and(|body| body.len() > 64 * 1024)
    {
        return Err("Body is too large".to_string());
    }
    Ok((url, method))
}

fn metadata_host_allowed(host: &str) -> bool {
    matches!(
        host,
        "accounts.spotify.com"
            | "api.spotify.com"
            | "amp-api.music.apple.com"
            | "music.apple.com"
            | "u.y.qq.com"
            | "ncmapi.bikonoo.com"
            | "music163.xuanmou.com.cn"
            | "neteasecloudmusicapi-main-api.vercel.app"
            | "api-enhanced-six-beta.vercel.app"
    )
}

fn filter_metadata_headers(headers: Option<&HashMap<String, String>>) -> Vec<(&str, &str)> {
    headers
        .into_iter()
        .flat_map(|items| items.iter())
        .filter_map(|(key, value)| {
            let normalized = key.to_ascii_lowercase();
            if matches!(
                normalized.as_str(),
                "accept"
                    | "accept-language"
                    | "authorization"
                    | "content-type"
                    | "origin"
                    | "referer"
                    | "user-agent"
            ) {
                Some((key.as_str(), value.as_str()))
            } else {
                None
            }
        })
        .collect()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
#[allow(clippy::missing_panics_doc)]
pub fn run() {
    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_decorum::init())
        .plugin(tauri_plugin_process::init());

    #[cfg(any(target_os = "macos", windows, target_os = "linux"))]
    {
        builder = builder.plugin(tauri_plugin_updater::Builder::new().build());
    }

    builder
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            #[cfg(target_os = "macos")]
            {
                use tao::rwh_06::HasWindowHandle;
                use tauri::Manager;
                use tauri_plugin_decorum::WebviewWindowExt;

                let main_window = app.get_webview_window("main").unwrap();
                main_window.set_traffic_lights_inset(16.0, 20.0).unwrap();
                main_window.make_transparent().unwrap();
                let main_window_clone = main_window.clone();
                main_window.on_window_event(move |evt| {
                    if let tauri::WindowEvent::Resized(_) = evt {
                        main_window_clone
                            .set_traffic_lights_inset(16.0, 20.0)
                            .unwrap();
                    }
                });
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_open_file_data,
            metadata_http_request,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
