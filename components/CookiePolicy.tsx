import React from 'react';
import Script from 'next/script';

const CookiePolicy = () => {
  return (
    <>
      <a
        href="https://www.iubenda.com/privacy-policy/20803775/cookie-policy"
        className="iubenda-white iubenda-noiframe iubenda-embed iubenda-noiframe"
        title="Cookie Policy"
      >
        <span className="px-2 border-l">Cookie Policy</span>
      </a>
      <Script
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            (function (w,d) {
              var loader = function () {
                var s = d.createElement("script"), tag = d.getElementsByTagName("script")[0];
                s.src="https://cdn.iubenda.com/iubenda.js";
                tag.parentNode.insertBefore(s,tag);
              };
              if(w.addEventListener){
                w.addEventListener("load", loader, false);
              } else if(w.attachEvent){
                w.attachEvent("onload", loader);
              } else{
                w.onload = loader;
              }
            })(window, document);
          `,
        }}
      />
    </>
  );
};

export default CookiePolicy;