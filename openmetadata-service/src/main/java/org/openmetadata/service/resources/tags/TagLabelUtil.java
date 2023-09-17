/*
 *  Copyright 2021 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.resources.tags;

import static org.openmetadata.schema.type.Include.NON_DELETED;

import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.classification.Classification;
import org.openmetadata.schema.entity.classification.Tag;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.TagLabel.TagSource;
import org.openmetadata.service.Entity;
import org.openmetadata.service.util.FullyQualifiedName;

@Slf4j
public class TagLabelUtil {
  private TagLabelUtil() {
    // Private constructor for utility class
  }

  public static Classification getClassification(String classificationName) {
    return Entity.getEntityByName(Entity.CLASSIFICATION, classificationName, "", NON_DELETED);
  }

  public static Tag getTag(String tagFqn) {
    return Entity.getEntityByName(Entity.TAG, tagFqn, "", NON_DELETED);
  }

  public static Glossary getGlossary(String glossaryName) {
    return Entity.getEntityByName(Entity.GLOSSARY, glossaryName, "", NON_DELETED);
  }

  public static GlossaryTerm getGlossaryTerm(String glossaryTermFqn) {
    return Entity.getEntityByName(Entity.GLOSSARY_TERM, glossaryTermFqn, "", NON_DELETED);
  }

  public static void applyTagCommonFields(TagLabel label) {
    if (label.getSource() == TagSource.CLASSIFICATION) {
      Tag tag = getTag(label.getTagFQN());
      label.setName(tag.getName());
      label.setDisplayName(tag.getDisplayName());
      label.setDescription(tag.getDescription());
    } else if (label.getSource() == TagSource.GLOSSARY) {
      GlossaryTerm glossaryTerm = getGlossaryTerm(label.getTagFQN());
      label.setName(glossaryTerm.getName());
      label.setDisplayName(glossaryTerm.getDisplayName());
      label.setDescription(glossaryTerm.getDescription());
    } else {
      throw new IllegalArgumentException("Invalid source type " + label.getSource());
    }
  }

  /** Returns true if the parent of the tag label is mutually exclusive */
  public static boolean mutuallyExclusive(TagLabel label) {
    String[] fqnParts = FullyQualifiedName.split(label.getTagFQN());
    String parentFqn = FullyQualifiedName.getParentFQN(fqnParts);
    boolean rootParent = fqnParts.length == 2;
    if (label.getSource() == TagSource.CLASSIFICATION) {
      return rootParent
          ? getClassification(parentFqn).getMutuallyExclusive()
          : getTag(parentFqn).getMutuallyExclusive();
    } else if (label.getSource() == TagSource.GLOSSARY) {
      return rootParent
          ? getGlossary(parentFqn).getMutuallyExclusive()
          : getGlossaryTerm(parentFqn).getMutuallyExclusive();
    } else {
      throw new IllegalArgumentException("Invalid source type " + label.getSource());
    }
  }
}
