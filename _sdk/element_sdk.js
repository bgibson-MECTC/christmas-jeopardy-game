// Minimal mock for element_sdk used by the page. Kept as no-op for now.
(function(){
  const mock = {
    // placeholder functions if code expects them
    someHelper() { return true; }
  };
  if (typeof window !== 'undefined') window.elementSdk = mock;
})();
