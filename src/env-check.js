// This is just a diagnostic file
console.log('================ ENV CHECK ================');
console.log('NEXT_PUBLIC_FIREBASE_PROJECT_ID:', process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID);
console.log('NEXT_PUBLIC_FIREBASE_API_KEY:', process.env.NEXT_PUBLIC_FIREBASE_API_KEY ? 'DEFINED' : 'UNDEFINED');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('==========================================');
