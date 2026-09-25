const fs = require('fs');
const file = '../lib/core/providers/store_provider.dart';
let content = fs.readFileSync(file, 'utf8');

const helpers = `
  Future<http.Response> _get(Uri url, {Map<String, String>? headers}) {
    return http.get(url, headers: headers).timeout(const Duration(seconds: 20));
  }

  Future<http.Response> _post(Uri url, {Map<String, String>? headers, Object? body}) {
    return http.post(url, headers: headers, body: body).timeout(const Duration(seconds: 20));
  }
`;

content = content.replace('StoreProvider(this.authProvider);', 'StoreProvider(this.authProvider);\n' + helpers);
content = content.replace(/await http\.post\(/g, 'await _post(');
content = content.replace(/await http\.get\(/g, 'await _get(');

fs.writeFileSync(file, content);
console.log('Fixed http requests');
