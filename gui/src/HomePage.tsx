import { FunctionComponent } from "react";
import LoginButton from "./LoginButton";
// import { getGitHubAccessToken } from "./App";

type Props = {
  // none
};

const HomePage: FunctionComponent<Props> = () => {
  return (
    <div style={{padding: 30}}>
      <h1>LINDI Cloud</h1>
      <LoginButton />
    </div>
  )
};

export default HomePage;
