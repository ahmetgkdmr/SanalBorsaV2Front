export const environment = {
  production: false,
  /** https launch-profile ile doğrudan 7285'e (http→https redirect hop'u CORS'u kırıyor). */
  apiUrl: 'https://localhost:7285/api',
  hubUrl: 'https://localhost:7285/hubs/crypto',

  firebase: {
    apiKey:            'AIzaSyC_klYwoZvXsxSfDHMxcxzpURGPcFXUMnY',
    authDomain:        'sanal-portfoy-cf5ad.firebaseapp.com',
    projectId:         'sanal-portfoy-cf5ad',
    storageBucket:     'sanal-portfoy-cf5ad.firebasestorage.app',
    messagingSenderId: '1090028287543',
    appId:             '1:1090028287543:web:8c362465c13116d3fd71b2',
  },
};
