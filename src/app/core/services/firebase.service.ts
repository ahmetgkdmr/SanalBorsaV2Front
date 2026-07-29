import { Injectable } from '@angular/core';
import { initializeApp, FirebaseApp, getApps } from 'firebase/app';
import {
  getAuth,
  Auth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import { environment } from '../../../environments/environment';

/**
 * Firebase Auth — şu an yalnızca Google.
 */
@Injectable({ providedIn: 'root' })
export class FirebaseService {
  private readonly app: FirebaseApp;
  private readonly auth: Auth;

  constructor() {
    this.app  = getApps().length ? getApps()[0] : initializeApp(environment.firebase);
    this.auth = getAuth(this.app);
  }

  /** Google hesabıyla popup açar, Firebase ID Token döner. */
  async signInWithGoogle(): Promise<string> {
    const provider = new GoogleAuthProvider();
    const result   = await signInWithPopup(this.auth, provider);
    return result.user.getIdToken();
  }

  /** Firebase oturumunu kapatır. */
  async signOut(): Promise<void> {
    await signOut(this.auth);
  }
}
