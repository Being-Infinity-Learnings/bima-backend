import 'package:dio/dio.dart';

import '../../config/environment.dart';

class ApiClient {
  static final Dio dio = Dio(
    BaseOptions(
      baseUrl: Environment.apiBaseUrl,
      headers: {
        'Content-Type': 'application/json',
      },
    ),
  );
}