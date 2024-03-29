import { FunctionComponent } from "react"
import LoginButton from "./LoginButton"

type Props = {
    // none
}

const LogInPage: FunctionComponent<Props> = () => {
    return (
        <div style={{padding: 30}}>
            <LoginButton />
        </div>
    )
}

export default LogInPage