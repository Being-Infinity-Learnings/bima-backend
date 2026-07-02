/// Repository responsible for the student-facing quiz REST calls.
///
/// This mirrors the pattern used by [AuthRepository]: fetch a fresh Firebase
/// ID token per-request and attach it as a Bearer token.
import 'package:dio/dio.dart';
import 'package:firebase_auth/firebase_auth.dart';

import '../../../core/network/api_client.dart';
import 'quiz_models.dart';

class QuizRepository {
  final FirebaseAuth _firebaseAuth = FirebaseAuth.instance;

  Future<String?> _idToken() => _firebaseAuth.currentUser?.getIdToken() ??
      Future.value(null);

  Future<Options> _authOptions() async {
    final token = await _idToken();
    return Options(headers: {'Authorization': 'Bearer $token'});
  }

  /// GET /quiz/my — quizzes the current student is eligible to see
  /// (SCHEDULED or LIVE, public or in one of their groups).
  Future<List<MyQuizSummary>> getMyQuizzes() async {
    final response = await ApiClient.dio.get(
      '/quiz/my',
      options: await _authOptions(),
    );

    final data = response.data['data'] as List? ?? [];
    return data
        .map((e) => MyQuizSummary.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  /// GET /quiz/my/:quizId — full detail + current runtime snapshot
  /// (null runtime means the host hasn't opened the lobby yet).
  Future<MyQuizDetail> getMyQuizById(String quizId) async {
    final response = await ApiClient.dio.get(
      '/quiz/my/$quizId',
      options: await _authOptions(),
    );

    return MyQuizDetail.fromJson(response.data['data'] as Map<String, dynamic>);
  }

  /// Fetches a fresh ID token for the socket handshake.
  Future<String?> getSocketToken() => _idToken();
}
