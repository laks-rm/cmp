// Run this in browser console while logged in to check your session

fetch('/api/auth/session')
  .then(r => r.json())
  .then(session => {
    console.log('=== SESSION INFO ===');
    console.log('User:', session?.user?.email);
    console.log('Entity IDs:', session?.user?.entityIds);
    console.log('Team IDs:', session?.user?.teamIds);
    console.log('Role:', session?.user?.roleName);
    
    if (!session?.user?.entityIds || session.user.entityIds.length === 0) {
      console.warn('⚠️ NO ENTITY IDS! This user has no entity access.');
      console.log('This would cause the calendar to show 0 tasks.');
    } else {
      console.log('✅ User has', session.user.entityIds.length, 'entity access(es)');
    }
  });
