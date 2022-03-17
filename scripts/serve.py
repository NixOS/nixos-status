import click
import livereload
import os


@click.command()
@click.option(
    '--common-styles',
    default=None,
    type=click.Path(
        exists=True,
        file_okay=False,
        dir_okay=True,
        readable=True,
        resolve_path=True,
    ),
)
def main(common_styles):
    server = livereload.Server()

    paths_to_watch = [
        "./*",
        "./images/*",
        "./styles/*",
    ]

    if common_styles is not None:
        paths_to_watch.append(common_styles)

    for path in paths_to_watch:
        server.watch(path, lambda: os.system("make"))

    os.system("make")

    server.serve(
        root="./output",
        port=os.getenv("PORT", 8000),
    )

if __name__ == "__main__":
    main()
