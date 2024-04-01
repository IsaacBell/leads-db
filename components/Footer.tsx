import { Pane } from "evergreen-ui";
import CookiePolicy from "./CookiePolicy";
import PrivacyPolicy from "./PrivacyPolicy";
import TermsAndConditions from "./TermsAndConditions";

const Footer = () => (<>
  <div className=" bg-gray-900">
      <div className="max-w-2xl mx-auto text-white py-10">
          <div className="text-center">
              <h3 className="text-3xl mb-3">LeadsDB</h3>
              <p>Developed by Soapstone Solutions</p>
          </div>
          {/* <div className="order-1 md:order-2">
              <span className="px-2">About us</span>
              <span className="px-2 border-l">Contact us</span>
          </div> */}
          <Pane className="text-center">
            <p>
              447 Broadway 2nd Floor #427
            </p>
            <p>
              New York, NY 10013
            </p>
            <p>
              <a href="mailto:isaacbell388@gmail.com">
                Contact Us
              </a>
            </p>
          </Pane>
          
          <div className="mt-28 flex flex-col md:flex-row md:justify-between items-center text-sm text-gray-400">
              <p className="order-2 md:order-1 mt-8 md:mt-0"> &copy; Soapstone Solutions, {new Date().getFullYear()}. </p>
              <div className="order-1 md:order-2">
                  <PrivacyPolicy />
                  <TermsAndConditions />
                  <CookiePolicy />
              </div>
          </div>
      </div>
  </div>
</>)

export default Footer;
