import 'package:dio/dio.dart';
import 'package:firebase_auth/firebase_auth.dart';

import '../../../core/network/api_client.dart';
import 'auth_models.dart';

import 'register_profile_request.dart';

class AuthRepository {
  final FirebaseAuth _firebaseAuth = FirebaseAuth.instance;

  User? get currentFirebaseUser => _firebaseAuth.currentUser;

  Future<String?> getIdToken() async {
    return await _firebaseAuth.currentUser?.getIdToken();
  }

  Future<UserModel> getMyProfile() async {
    final token = await getIdToken();

    final response = await ApiClient.dio.get(
      '/auth/me',
      options: Options(headers: {'Authorization': 'Bearer $token'}),
    );

    return UserModel.fromJson(response.data['data']);
  }

  Future<void> signIn({required String email, required String password}) async {
    await _firebaseAuth.signInWithEmailAndPassword(
      email: email,
      password: password,
    );
  }

  Future<void> signOut() async {
    await _firebaseAuth.signOut();
  }

  Future<void> createFirebaseUser({
    required String email,
    required String password,
  }) async {
    await _firebaseAuth.createUserWithEmailAndPassword(
      email: email,
      password: password,
    );
  }

  Future<UserModel> registerProfile(RegisterProfileRequest request) async {
    final token = await getIdToken();

    final response = await ApiClient.dio.post(
      '/auth/register-profile',
      data: request.toJson(),
      options: Options(headers: {'Authorization': 'Bearer $token'}),
    );

    return UserModel.fromJson(response.data['data']);
  }
}
