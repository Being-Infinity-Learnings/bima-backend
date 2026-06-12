/// Repository responsible for authentication and profile network operations.
///
/// This file bridges Firebase auth and the backend API.
import 'package:dio/dio.dart';
import 'package:firebase_auth/firebase_auth.dart';

import '../../../core/network/api_client.dart';
import 'auth_models.dart';

import 'register_profile_request.dart';
import 'update_profile_request.dart';

class AuthRepository {
  final FirebaseAuth _firebaseAuth = FirebaseAuth.instance;

  /// Returns the currently signed-in Firebase user, if any.
  User? get currentFirebaseUser => _firebaseAuth.currentUser;

  /// Retrieves the current Firebase ID token for authenticated backend calls.
  Future<String?> getIdToken() async {
    return await _firebaseAuth.currentUser?.getIdToken();
  }

  /// Fetches the authenticated user's profile from the backend.
  Future<UserModel> getMyProfile() async {
    final token = await getIdToken();

    final response = await ApiClient.dio.get(
      '/auth/me',
      options: Options(headers: {'Authorization': 'Bearer $token'}),
    );

    return UserModel.fromJson(response.data['data']);
  }

  /// Signs in the user with Firebase email/password credentials.
  Future<void> signIn({required String email, required String password}) async {
    await _firebaseAuth.signInWithEmailAndPassword(
      email: email,
      password: password,
    );
  }

  /// Signs the user out of Firebase.
  Future<void> signOut() async {
    await _firebaseAuth.signOut();
  }

  /// Creates a new user account in Firebase Authentication.
  Future<void> createFirebaseUser({
    required String email,
    required String password,
  }) async {
    await _firebaseAuth.createUserWithEmailAndPassword(
      email: email,
      password: password,
    );
  }

  /// Sends completed profile data to the backend and returns the saved user.
  Future<UserModel> registerProfile(RegisterProfileRequest request) async {
    final token = await getIdToken();

    final response = await ApiClient.dio.post(
      '/auth/register-profile',
      data: request.toJson(),
      options: Options(headers: {'Authorization': 'Bearer $token'}),
    );

    return UserModel.fromJson(response.data['data']);
  }

  Future<UserModel> updateProfile(UpdateProfileRequest request) async {
    final token = await getIdToken();

    final response = await ApiClient.dio.patch(
      '/auth/me',
      data: request.toJson(),
      options: Options(headers: {'Authorization': 'Bearer $token'}),
    );

    return UserModel.fromJson(response.data['data']);
  }

  Future<void> verifyPhoneNumber({
    required String phoneNumber,
    required PhoneVerificationCompleted verificationCompleted,
    required PhoneVerificationFailed verificationFailed,
    required PhoneCodeSent codeSent,
    required PhoneCodeAutoRetrievalTimeout codeAutoRetrievalTimeout,
  }) {
    return FirebaseAuth.instance.verifyPhoneNumber(
      phoneNumber: phoneNumber,

      verificationCompleted: verificationCompleted,

      verificationFailed: verificationFailed,

      codeSent: codeSent,

      codeAutoRetrievalTimeout: codeAutoRetrievalTimeout,
    );
  }

  Future<UserCredential> signInWithOtp({
    required String verificationId,
    required String otp,
  }) async {
    final credential = PhoneAuthProvider.credential(
      verificationId: verificationId,
      smsCode: otp,
    );

    return FirebaseAuth.instance.signInWithCredential(credential);
  }
}
