from http.server import HTTPServer, BaseHTTPRequestHandler
import json
import urllib.parse
from datetime import datetime

# For http.extension tests
class EchoHandler(BaseHTTPRequestHandler):
    def _send_cors_headers(self):
        """Send CORS headers to allow requests from browser"""
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', '*')
    
    def _send_json_response(self, data, status=200):
        """Send JSON response with proper headers"""
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self._send_cors_headers()
        self.end_headers()
        self.wfile.write(json.dumps(data, indent=2).encode('utf-8'))
    
    def _get_request_data(self):
        """Extract request data common to all methods"""
        # Parse URL and query parameters
        parsed_url = urllib.parse.urlparse(self.path)
        query_params = urllib.parse.parse_qs(parsed_url.query)
        
        # Get headers (excluding some internal ones)
        headers = {}
        for header, value in self.headers.items():
            if header.lower() not in ['host', 'content-length']:
                headers[header] = value
        
        body = None
        content_length = self.headers.get('Content-Length')
        if content_length:
            body_bytes = self.rfile.read(int(content_length))
            body_str = body_bytes.decode('utf-8')
            
            try:
                body = json.loads(body_str)
            except json.JSONDecodeError:
                body = body_str
        
        return {
            'timestamp': datetime.now().isoformat(),
            'method': self.command,
            'path': parsed_url.path,
            'query_params': query_params,
            'headers': headers,
            'body': body,
            'client_address': f"{self.client_address[0]}:{self.client_address[1]}"
        }
    
    def do_OPTIONS(self):
        """Handle preflight CORS requests"""
        self.send_response(200)
        self._send_cors_headers()
        self.end_headers()
    
    def do_GET(self):
        """Handle GET requests"""
        data = self._get_request_data()
        self._send_json_response(data)
    
    def do_POST(self):
        """Handle POST requests"""
        data = self._get_request_data()
        self._send_json_response(data)
    
    def do_PUT(self):
        """Handle PUT requests"""
        data = self._get_request_data()
        self._send_json_response(data)
    
    def do_DELETE(self):
        """Handle DELETE requests"""
        data = self._get_request_data()
        self._send_json_response(data)
    
    def log_message(self, format, *args):
        """Custom log format"""
        print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] {format % args}")

def run_server(port=8888):
    """Run the echo server"""
    server_address = ('', port)
    httpd = HTTPServer(server_address, EchoHandler)
    
    print(f"Echo server starting on http://localhost:{port}")
    print("Press Ctrl+C to stop")
    print("-" * 50)
    
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped")
        httpd.shutdown()

if __name__ == '__main__':
    run_server()