/// Thin wrapper around `socket_io_client` for the live quiz runtime.
///
/// One instance of this service is created per quiz-attempt (see
/// [QuizRuntimeController]) and is responsible for:
///   • opening an authenticated Socket.IO connection
///   • emitting `joinQuiz` / `submitAnswer`
///   • exposing the server's events as simple Dart callbacks
///
/// The backend (see `socket.auth.js`) expects the Firebase ID token in
/// `socket.handshake.auth.token`.
import 'package:socket_io_client/socket_io_client.dart' as io;

import '../../../config/environment.dart';

typedef JsonMap = Map<String, dynamic>;
typedef JsonCallback = void Function(JsonMap data);
typedef VoidCallback0 = void Function();

class QuizSocketService {
  io.Socket? _socket;

  bool get isConnected => _socket?.connected ?? false;

  /// Opens the connection and wires up the fixed set of quiz runtime events.
  /// Call [joinQuiz] once `onConnect` fires (or immediately after — the
  /// event is buffered by socket.io until the handshake completes).
  void connect({
    required String token,
    required VoidCallback0 onConnect,
    required void Function(String message) onConnectError,
    required VoidCallback0 onDisconnect,
    required JsonCallback onQuizJoined,
    required JsonCallback onJoinQuizError,
    required JsonCallback onRuntimeUpdated,
    required JsonCallback onLeaderboardUpdated,
    required JsonCallback onQuestionResults,
    required JsonCallback onFinalResults,
    required VoidCallback0 onAnswerSubmitted,
    required void Function(String message) onAnswerSubmissionError,
  }) {
    _socket?.dispose();

    final socket = io.io(
      Environment.apiBaseUrl,
      io.OptionBuilder()
          // Keep websocket first, but allow polling fallback so the client
          // can still connect on networks where websocket upgrades are flaky.
          .setTransports(['websocket', 'polling'])
          .disableAutoConnect()
          .setAuth({'token': token})
          .build(),
    );

    _socket = socket;

    socket.onConnect((_) => onConnect());
    socket.onConnectError(
      (err) => onConnectError(err?.toString() ?? 'Connection error'),
    );
    socket.onError((err) => onConnectError(err?.toString() ?? 'Socket error'));
    socket.onDisconnect((_) => onDisconnect());

    socket.on('quizJoined', (data) => onQuizJoined(_asMap(data)));
    socket.on('joinQuizError', (data) => onJoinQuizError(_asMap(data)));
    socket.on('runtimeUpdated', (data) => onRuntimeUpdated(_asMap(data)));
    socket.on(
      'leaderboardUpdated',
      (data) => onLeaderboardUpdated(_asMap(data)),
    );
    socket.on('questionResults', (data) => onQuestionResults(_asMap(data)));
    socket.on('finalResults', (data) => onFinalResults(_asMap(data)));
    socket.on('answerSubmitted', (_) => onAnswerSubmitted());
    socket.on(
      'answerSubmissionError',
      (data) => onAnswerSubmissionError(
        (_asMap(data)['message'] as String?) ?? 'Could not submit answer',
      ),
    );

    socket.connect();
  }

  void joinQuiz(String quizId) {
    _socket?.emit('joinQuiz', {'quizId': quizId});
  }

  void submitAnswer({
    required String questionId,
    required List<String> selectedOptionIds,
  }) {
    _socket?.emit('submitAnswer', {
      'questionId': questionId,
      'selectedOptionIds': selectedOptionIds,
    });
  }

  void disconnect() {
    _socket?.disconnect();
    _socket?.dispose();
    _socket = null;
  }

  JsonMap _asMap(dynamic data) {
    if (data is Map<String, dynamic>) return data;
    if (data is Map) return Map<String, dynamic>.from(data);
    return <String, dynamic>{};
  }
}
