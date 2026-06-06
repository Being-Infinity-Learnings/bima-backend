import 'package:dio/dio.dart';

import '../../config/environment.dart';

/// Provides a singleton API client configured for the backend.
///
/// This client is reused for authenticated API calls.
class ApiClient {
  /// Dio instance used for HTTP requests to the backend.
  static final Dio dio = Dio(
    BaseOptions(
      baseUrl: Environment.apiBaseUrl,
      headers: {'Content-Type': 'application/json'},
    ),
  );
}
