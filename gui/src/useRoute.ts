import { useCallback, useMemo } from "react"
import { useLocation, useNavigate } from "react-router-dom"

export type Route = {
    page: 'home'
} | {
    page: 'loggedIn'
    accessToken: string
} | {
    page: 'logIn' // this is where the user is prompted to log in with github
} | {
    page: 'lindiCloudLogin' // this is the redirect page that gets the access token
    accessToken: string
}

const useRoute = () => {
    const location = useLocation()
    const navigate = useNavigate()
    const p = location.pathname
    const search = location.search
    const searchParams = useMemo(() => new URLSearchParams(search), [search])
    const route: Route = useMemo(() => {
        if (p === '/loggedIn') {
            const accessToken = searchParams.get('access_token')
            if (!accessToken) {
                throw new Error('Missing access token')
            }
            return {
                page: 'loggedIn',
                accessToken
            }
        }
        else if (p === '/logIn') {
            return {
                page: 'logIn'
            }
        }
        else if (p === '/lindi-cloud-login') {
            return {
                page: 'lindiCloudLogin',
                accessToken: searchParams.get('access_token') || ''
            }
        }
        else {
            return {
                page: 'home'
            }
        }
    }, [p, searchParams])

    const setRoute = useCallback((r: Route) => {
        if (r.page === 'loggedIn') {
            navigate(`/loggedIn?access_token=${r.accessToken}`)
        }
        else if (r.page === 'logIn') {
            navigate('/logIn')
        }
        else if (r.page === 'lindiCloudLogin') {
            navigate(`/lindi-cloud-login?access_token=${r.accessToken}`)
        }
        else {
            navigate('/')
        }
    }, [navigate])

    return {
        route,
        setRoute
    }
}

export default useRoute