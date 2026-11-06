// CLAUDE.md, "Memória": three.js frees the GPU side of a mesh only on dispose(). A `removeFromParent()` in a function that never frees anything
// (dispose, discardObject3D, releaseObject3D) leaves the geometry, materials and textures of what left the scene on the GPU. Use discardObject3D
// of game-shapes-three; when the object comes back later (a pool, a holder, an avatar swapped), say so in an eslint-disable comment.
const FREES = /\bdispose\w*\s*(\?\.)?\s*\(|discardObject3D|releaseObject3D|dropTree/

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: 'problem',
    docs: { description: 'removeFromParent() without freeing what left the scene (CLAUDE.md, Memória)' },
    messages: {
      bare: 'removeFromParent() alone keeps the GPU side of what left the scene: use discardObject3D (game-shapes-three), or say why it comes back (eslint-disable-next-line kit/no-bare-remove -- reason).',
    },
    schema: [],
  },
  create(context) {
    const source = context.sourceCode ?? context.getSourceCode()
    return {
      "CallExpression[callee.type='MemberExpression'][callee.property.name='removeFromParent'][arguments.length=0]"(/** @type {import('eslint').Rule.Node} */ node) {
        let scope = node.parent
        while (scope && !/Function/.test(scope.type) && scope.type !== 'Program') scope = scope.parent
        if (scope && FREES.test(source.getText(scope))) return
        context.report({ node, messageId: 'bare' })
      },
    }
  },
}
