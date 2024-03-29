import { FunctionComponent } from "react";
import FileBrowser from "./FileBrowser/FileBrowser";
// import { getGitHubAccessToken } from "./App";

type Props = {
  // none
};

const HomePage: FunctionComponent<Props> = () => {
  return (
    <div style={{padding: 30}}>
      <h1>LINDI Cloud</h1>
      <hr />
      <FileBrowser />
    </div>
  )
};

export default HomePage;
