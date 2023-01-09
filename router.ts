import * as Peko from "peko"
import { recursiveReaddir } from "recursiveReadDir"
import { fromFileUrl } from "fromFileUrl"
import MarkdownIt from "markdownit"

const md = new MarkdownIt()
export const router = new Peko.Server()
const cache = new Peko.ResponseCache()

const prod = Deno.env.get("ENVIRONMENT") === "production"
const headers = new Headers({
  "Cache-Control": prod ? "max-age=600, stale-while-revalidate=86400" : ""
})

const indexUrl = new URL("./pages/index.html", import.meta.url)
const aboutUrl = new URL("./pages/about.html", import.meta.url)
const blogHTML = await Deno.readTextFile(new URL("./pages/blog.html", import.meta.url))
const articles = await recursiveReaddir(fromFileUrl(new URL("./articles", import.meta.url)))

router.addRoute("/", Peko.staticHandler(indexUrl, { headers }))
router.addRoute("/about", Peko.staticHandler(aboutUrl, { headers }))
router.addRoute("/blog", Peko.ssrHandler(() => {
  return blogHTML.replace(
    /(?<=<main(.)*>)(.|\n)*?(?=<\/main>)/,
    `<h1>Stuff</h1>
    <ul class="article-list">
      ${articles.map(path => {
        const name = path.slice(`${Deno.cwd()}/articles`.length+1).slice(0, -3)
        return `<li>
          <a href="/blog/${name}">
            <h2>${name}</h2>
          </a>
        </li>`
      }).join("\n")}
    </ul>`
  )
}))

articles.forEach(async (file) => {
  const fileRoute = file.slice(`${Deno.cwd()}/articles`.length+1)
  const articleMD = await Deno.readTextFile(file)

  return router.addRoute(
    `/blog/${fileRoute.slice(0, -3)}`, 
    prod ? Peko.cacher(cache) : [], 
    Peko.ssrHandler(() => blogHTML.replace(
      /(?<=<main(.)*>)(.|\n)*?(?=<\/main>)/,
      md.render(articleMD)
    ))
  )
})

const staticFiles = await recursiveReaddir(fromFileUrl(new URL("./static", import.meta.url)))
staticFiles.forEach((file): number => {
  const fileRoute = file.slice(`${Deno.cwd()}/static`.length+1)
  return router.addRoute(
    `/${fileRoute}`, 
    prod ? Peko.cacher(cache) : [], 
    Peko.staticHandler(new URL(`./static/${fileRoute}`, import.meta.url))
  )
})
