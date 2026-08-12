import { PageFrame, PageFrameProps } from "./types"
import HeaderConstructor from "../Header"

const Header = HeaderConstructor()

/**
 * The default page frame — three-column layout with left sidebar, center
 * content (header + body + afterBody), and right sidebar, followed by a footer.
 *
 * This is the original Quartz layout, extracted from renderPage.tsx.
 */
export const DefaultFrame: PageFrame = {
  name: "default",
  render({
    componentData,
    header,
    beforeBody,
    pageBody: Content,
    afterBody,
    left,
    right,
    footer: Footer,
  }: PageFrameProps) {
    return (
      <>
        {left.length > 0 && (
          <>
            <input
              type="checkbox"
              id="q-sidebar-left"
              class="sidebar-peg-toggle"
              tabindex={-1}
              aria-hidden="true"
            />
            <label
              for="q-sidebar-left"
              class="sidebar-peg sidebar-peg-left"
              aria-label="Toggle explorer sidebar"
            ></label>
            <div class="left sidebar">
              <label for="q-sidebar-left" class="sidebar-minimize" aria-label="Collapse explorer">
                ✕
              </label>
              {left.map((BodyComponent) => (
                <BodyComponent {...componentData} />
              ))}
            </div>
          </>
        )}
        <div class="center">
          <div class="page-header">
            <Header {...componentData}>
              {header.map((HeaderComponent) => (
                <HeaderComponent {...componentData} />
              ))}
            </Header>
            <div class="popover-hint">
              {beforeBody.map((BodyComponent) => (
                <BodyComponent {...componentData} />
              ))}
            </div>
          </div>
          <Content {...componentData} />
          <hr />
          <div class="page-footer">
            {afterBody.map((BodyComponent) => (
              <BodyComponent {...componentData} />
            ))}
          </div>
        </div>
        {right.length > 0 && (
          <>
            <input
              type="checkbox"
              id="q-sidebar-right"
              class="sidebar-peg-toggle"
              tabindex={-1}
              aria-hidden="true"
            />
            <label
              for="q-sidebar-right"
              class="sidebar-peg sidebar-peg-right"
              aria-label="Toggle table of contents sidebar"
            ></label>
            <div class="right sidebar">
              <label
                for="q-sidebar-right"
                class="sidebar-minimize"
                aria-label="Collapse table of contents"
              >
                ✕
              </label>
              {right.map((BodyComponent) => (
                <BodyComponent {...componentData} />
              ))}
            </div>
          </>
        )}
        <Footer {...componentData} />
      </>
    )
  },
}
